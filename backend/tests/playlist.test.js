/**
 * Pruebas unitarias de Playlists
 * - Listado de playlists (Modo Artista/Admin)
 * - Alta manual de playlist (Modo Curador)
 * - Validación estricta de URLs anti-XSS/SQLi
 */
const request = require('supertest');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'test_secret_secure';
process.env.JWT_EXPIRES_IN = '1h';

// Mock de la capa de BD
jest.mock('../config/db', () => {
  return {
    executeQuery: jest.fn(async (sql) => {
      if (sql.includes('FROM playlists p')) {
        return [
          { id: 1, name: 'Vibraciones', followers: 1200, spotify_url: 'https://open.spotify.com/playlist/pl123', owner_id: 2, owner: 'curator1' },
          { id: 2, name: 'Grunge', followers: 340, spotify_url: 'https://open.spotify.com/playlist/pl456', owner_id: 1, owner: 'admin' }
        ];
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

const app = require('../server');

const tokenFor = (id, role) =>
  jwt.sign({ id, username: 'user', role }, process.env.JWT_SECRET, { expiresIn: '1h' });

describe('Playlists OverDrive', () => {
  describe('GET /api/playlists', () => {
    test('Debe listar playlists con su dueño (200)', async () => {
      const res = await request(app)
        .get('/api/playlists')
        .set('Authorization', `Bearer ${tokenFor(1, 'administrador')}`);

      expect(res.status).toBe(200);
      expect(res.body.playlists).toHaveLength(2);
      expect(res.body.playlists[0].owner).toBe('curator1');
    });

    test('Debe rechazar sin token (401)', async () => {
      const res = await request(app).get('/api/playlists');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/playlists', () => {
    test('Debe registrar una playlist válida (201)', async () => {
      const res = await request(app)
        .post('/api/playlists')
        .set('Authorization', `Bearer ${tokenFor(2, 'usuario')}`)
        .send({
          name: 'Mi Setlist',
          spotifyUrl: 'https://open.spotify.com/playlist/4HQ8V00dH7a2c3Bv4wbCLA',
          followers: 250
        });

      expect(res.status).toBe(201);
      expect(res.body.message).toContain('Playlist registrada');
    });

    test('Debe rechazar URL que no es de playlist de Spotify (400)', async () => {
      const res = await request(app)
        .post('/api/playlists')
        .set('Authorization', `Bearer ${tokenFor(2, 'usuario')}`)
        .send({
          name: 'Mi Setlist',
          spotifyUrl: 'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT',
          followers: 0
        });

      expect(res.status).toBe(400);
    });

    test('Debe rechazar URL con inyección de caracteres extraños (400)', async () => {
      const res = await request(app)
        .post('/api/playlists')
        .set('Authorization', `Bearer ${tokenFor(2, 'usuario')}`)
        .send({
          name: 'Playlist',
          spotifyUrl: 'https://open.spotify.com/playlist/abc"; DROP TABLE users;',
          followers: 0
        });

      expect(res.status).toBe(400);
    });

    test('Debe rechazar nombre vacío (400)', async () => {
      const res = await request(app)
        .post('/api/playlists')
        .set('Authorization', `Bearer ${tokenFor(2, 'usuario')}`)
        .send({
          name: '',
          spotifyUrl: 'https://open.spotify.com/playlist/4HQ8V00dH7a2c3Bv4wbCLA'
        });

      expect(res.status).toBe(400);
    });

    test('Debe rechazar sin token (401)', async () => {
      const res = await request(app)
        .post('/api/playlists')
        .send({
          name: 'X',
          spotifyUrl: 'https://open.spotify.com/playlist/4HQ8V00dH7a2c3Bv4wbCLA'
        });
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/submissions/curator', () => {
    test('Debe listar propuestas recibidas por el curador (200)', async () => {
      const res = await request(app)
        .get('/api/submissions/curator')
        .set('Authorization', `Bearer ${tokenFor(2, 'usuario')}`);
      expect(res.status).toBe(200);
      expect(res.body.submissions).toBeDefined();
    });
  });
});