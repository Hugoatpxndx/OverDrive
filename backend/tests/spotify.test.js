/**
 * Pruebas unitarias de la integración con Spotify
 * - Generación de URL de autorización (OAuth)
 * - Callback (validación de state + intercambio de code)
 * - Importación de playlists reales con seguidores
 * - Estado de conexión y desconexión
 */
const request = require('supertest');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'test_secret_secure';
process.env.JWT_EXPIRES_IN = '1h';
process.env.SPOTIFY_CLIENT_ID = 'test_client';
process.env.SPOTIFY_CLIENT_SECRET = 'test_secret';

// Mock de la capa de BD
const dbState = {
  connectedUser: {
    spotify_access_token: 'access_ok',
    spotify_refresh_token: 'refresh_ok'
  },
  disconnectedUser: {
    spotify_access_token: null,
    spotify_refresh_token: null
  },
  noUser: false
};

jest.mock('../config/db', () => {
  return {
    executeQuery: jest.fn(async (sql, params) => {
      if (sql.includes('FROM users WHERE id')) {
        if (dbState.noUser) return [];
        const userId = params[0];
        return [userId === 1 ? dbState.connectedUser : dbState.disconnectedUser];
      }
      return [];
    }),
    getConnection: jest.fn(async () => ({
      execute: jest.fn(async () => [[]]),
      release: jest.fn()
    })),
    pool: { getConnection: jest.fn() }
  };
});

// Mock del cliente HTTP de Spotify (no hacer llamadas reales)
jest.mock('../config/spotify', () => ({
  buildAuthUrl: (state) => `https://accounts.spotify.com/authorize?client_id=x&state=${state}`,
  exchangeCode: jest.fn(async () => ({ access_token: 'new_access', refresh_token: 'new_refresh' })),
  refreshAccessToken: jest.fn(async () => ({ access_token: 'refreshed_access' })),
  getMyPlaylists: jest.fn(async () => [
    { id: 'pl_famous', name: 'Famous Hits', external_urls: { spotify: 'https://open.spotify.com/playlist/pl_famous' } },
    { id: 'pl_empty', name: 'Sin seguidores', external_urls: { spotify: 'https://open.spotify.com/playlist/pl_empty' } }
  ]),
  getPlaylistFollowers: jest.fn(async (_tok, id) => (id === 'pl_famous' ? 4521 : 0))
}));

const app = require('../server');

const tokenFor = (id, role = 'usuario') =>
  jwt.sign({ id, username: 'user', role }, process.env.JWT_SECRET, { expiresIn: '1h' });

describe('Integración Spotify', () => {
  describe('GET /api/spotify/auth-url', () => {
    test('Debe generar una URL de autorización (200)', async () => {
      const res = await request(app)
        .get('/api/spotify/auth-url')
        .set('Authorization', `Bearer ${tokenFor(1, 'administrador')}`);

      expect(res.status).toBe(200);
      expect(res.body.authUrl).toContain('accounts.spotify.com/authorize');
      expect(res.body.authUrl).toContain('state=');
    });

    test('Debe responder 503 si faltan credenciales de Spotify', async () => {
      const savedId = process.env.SPOTIFY_CLIENT_ID;
      const savedSecret = process.env.SPOTIFY_CLIENT_SECRET;
      delete process.env.SPOTIFY_CLIENT_ID;
      delete process.env.SPOTIFY_CLIENT_SECRET;

      const res = await request(app)
        .get('/api/spotify/auth-url')
        .set('Authorization', `Bearer ${tokenFor(1, 'administrador')}`);

      process.env.SPOTIFY_CLIENT_ID = savedId;
      process.env.SPOTIFY_CLIENT_SECRET = savedSecret;

      expect(res.status).toBe(503);
    });

    test('Debe rechazar sin token (401)', async () => {
      const res = await request(app).get('/api/spotify/auth-url');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/spotify/callback', () => {
    test('Debe intercambiar el code y redirigir al dashboard (302 connected)', async () => {
      // Obtener el state emitido al generar la auth-url
      const authRes = await request(app)
        .get('/api/spotify/auth-url')
        .set('Authorization', `Bearer ${tokenFor(1, 'administrador')}`);
      const state = new URL(authRes.body.authUrl).searchParams.get('state');

      const res = await request(app).get(
        `/api/spotify/callback?code=codigo_valid&state=${state}`
      );

      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('spotify=connected');
    });

    test('Debe rechazar state inválido (302 error)', async () => {
      const res = await request(app).get(
        '/api/spotify/callback?code=abc&state=state_inventado'
      );
      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('spotify=error');
    });

    test('Debe rechazar si Spotify no devuelve refresh token (302 error)', async () => {
      const { exchangeCode } = require('../config/spotify');
      exchangeCode.mockResolvedValueOnce({ access_token: 'only_access' });

      const authRes = await request(app)
        .get('/api/spotify/auth-url')
        .set('Authorization', `Bearer ${tokenFor(1, 'administrador')}`);
      const state = new URL(authRes.body.authUrl).searchParams.get('state');

      const res = await request(app).get(
        `/api/spotify/callback?code=codigo&state=${state}`
      );

      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('spotify=error');
    });
  });

  describe('GET /api/spotify/playlists', () => {
    test('Debe importar playlists con su número real de seguidores (200)', async () => {
      const res = await request(app)
        .get('/api/spotify/playlists')
        .set('Authorization', `Bearer ${tokenFor(1, 'administrador')}`);

      expect(res.status).toBe(200);
      expect(res.body.count).toBe(2);
      expect(res.body.message).toContain('importadas');
    });

    test('Debe responder 400 si el usuario no conectó Spotify', async () => {
      const res = await request(app)
        .get('/api/spotify/playlists')
        .set('Authorization', `Bearer ${tokenFor(2, 'usuario')}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('conecta');
    });
  });

  describe('GET /api/spotify/status', () => {
    test('Debe reportar conectado cuando hay tokens guardados', async () => {
      const res = await request(app)
        .get('/api/spotify/status')
        .set('Authorization', `Bearer ${tokenFor(1, 'administrador')}`);

      expect(res.status).toBe(200);
      expect(res.body.connected).toBe(true);
    });

    test('Debe reportar no conectado cuando no hay tokens', async () => {
      const res = await request(app)
        .get('/api/spotify/status')
        .set('Authorization', `Bearer ${tokenFor(2, 'usuario')}`);

      expect(res.status).toBe(200);
      expect(res.body.connected).toBe(false);
    });
  });

  describe('POST /api/spotify/disconnect', () => {
    test('Debe desvincular la cuenta de Spotify (200)', async () => {
      const res = await request(app)
        .post('/api/spotify/disconnect')
        .set('Authorization', `Bearer ${tokenFor(1, 'administrador')}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('desconectada');
    });
  });
});