/**
 * Pruebas unitarias de Envío de Canciones (Submissions)
 * - Validación de URL anti-XSS/SQLi
 * - Control de tokens
 */
const request = require('supertest');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'test_secret_secure';
process.env.JWT_EXPIRES_IN = '1h';

// Mock de la capa de BD con un estado simulado simple
const dbState = {
  users: [
    { id: 1, username: 'admin', tokens: 10, role: 'administrador' },
    { id: 2, username: 'curator1', tokens: 5, role: 'usuario' },
    { id: 3, username: 'artist1', tokens: 1, role: 'usuario' },
    { id: 4, username: 'artist_nopobre', tokens: 0, role: 'usuario' }
  ],
  playlists: [
    { id: 1, user_id: 2, spotify_id: 'playlistA', name: 'Vibraciones', followers: 1200 }
  ],
  submissions: [],
  nextSubId: 1,
  failNextError: false
};

jest.mock('../config/db', () => {
  const runSql = jest.fn(async (sql, params) => {
          if (dbState.failNextError) {
            throw new Error('Error interno de BD simulado');
          }
          // SELECT de usuarios por id (revisión de tokens del artista)
          if (sql.includes('SELECT id, tokens FROM users WHERE id')) {
            const user = dbState.users.find((u) => u.id === params[0]);
            return [user ? [user] : []];
          }
          // SELECT de playlist por id
          if (sql.includes('SELECT id, user_id FROM playlists')) {
            const pl = dbState.playlists.find((p) => p.id === params[0]);
            return [pl ? [pl] : []];
          }
          // Decremento atómico de tokens (solo si tokens >= 1)
          if (sql.includes('UPDATE users SET tokens = tokens - 1')) {
            const user = dbState.users.find((u) => u.id === params[0]);
            if (user && user.tokens >= 1) {
              user.tokens -= 1;
              return [{ affectedRows: 1 }];
            }
            return [{ affectedRows: 0 }];
          }
          // UPDATE de tokens con LEAST (aceptar propuesta: +1 token)
          if (sql.includes('UPDATE users SET tokens = LEAST(tokens + 1, 10)')) {
            const user = dbState.users.find((u) => u.id === params[0]);
            if (user) {
              user.tokens = Math.min(user.tokens + 1, 10);
              return [{ affectedRows: 1 }];
            }
            return [{ affectedRows: 0 }];
          }
          // Query JOIN para aceptar/rechazar propuesta (submissions + playlists)
          if (sql.includes('JOIN playlists p ON p.id = s.playlist_id') && sql.includes('WHERE s.id')) {
            const sub = dbState.submissions.find((s) => s.id === params[0]);
            if (!sub) {
              return [[]];
            }
            return [[{
              id: sub.id,
              status: sub.status,
              artist_id: sub.artist_id,
              playlist_id: sub.playlist_id,
              track_url: sub.track_url,
              playlist_owner: dbState.playlists.find((p) => p.id === sub.playlist_id)?.user_id,
              playlist_spotify_id: dbState.playlists.find((p) => p.id === sub.playlist_id)?.spotify_id
            }]];
          }
          // Consulta de tokens de Spotify del curador (sync real al aceptar)
          if (sql.includes('spotify_access_token, spotify_refresh_token')) {
            return [[{
              id: params[0],
              spotify_access_token: 'tok_curator',
              spotify_refresh_token: 'rf_curator'
            }]];
          }
          // UPDATE de submissions (marcar aprobada/rechazada)
          if (sql.includes('UPDATE submissions SET status')) {
            const sub = dbState.submissions.find((s) => s.id === params[2]);
            if (sub && sub.status === 'pendiente') {
              sub.status = params[0];
              return [{ affectedRows: 1 }];
            }
            return [{ affectedRows: 0 }];
          }
          // LISTAR mis propuestas (JOIN con playlists)
          if (sql.includes('ORDER BY s.created_at DESC')) {
            const artistSubs = dbState.submissions
              .filter((s) => s.artist_id === params[0])
              .map((s) => ({
                id: s.id,
                track_url: s.track_url,
                track_name: s.track_name,
                status: s.status,
                playlist_name: dbState.playlists.find((p) => p.id === s.playlist_id)?.name
              }));
            return [artistSubs];
          }
          // INSERT de submission (simula constraint UNIQUE para duplicados)
          if (sql.includes('INSERT INTO submissions')) {
            const duplicate = dbState.submissions.some(
              (s) => s.track_url === params[2] && s.playlist_id === params[1]
            );
            if (duplicate) {
              const err = new Error('Duplicate entry');
              err.code = 'ER_DUP_ENTRY';
              throw err;
            }
            const sub = {
              id: dbState.nextSubId++,
              artist_id: params[0],
              playlist_id: params[1],
              track_url: params[2],
              track_name: params[3]
            };
            dbState.submissions.push(sub);
            return [{ insertId: sub.id, affectedRows: 1 }];
          }
          // SELECT de tokens restantes
          if (sql.includes('SELECT tokens FROM users')) {
            const user = dbState.users.find((u) => u.id === params[0]);
            return [[{ tokens: user ? user.tokens : 0 }]];
          }
          // Query de eventos/estado (unificar con SELECT generico)
          if (sql.includes('SELECT s.id, s.status')) {
            return [[]];
          }
          return [[]];
  });

  return {
    executeQuery: async (sql, params) => {
      const [rows] = await runSql(sql, params);
      return rows;
    },
    getConnection: jest.fn(async () => ({
      execute: runSql,
      release: jest.fn()
    })),
    pool: { getConnection: jest.fn() }
  };
});

// Mock del cliente HTTP de Spotify (no hacer llamadas reales de red)
jest.mock('../config/spotify', () => ({
  addTracksToPlaylist: jest.fn(async () => ({ snapshot_id: 'snap_test' })),
  refreshAccessToken: jest.fn(async () => ({ access_token: 'refreshed_access' }))
}));

const app = require('../server');

const createToken = (userId, role) => {
  return jwt.sign(
    { id: userId, username: 'test', role },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
};

// Resetear el estado simulado antes de cada test
beforeEach(() => {
  dbState.users = [
    { id: 1, username: 'admin', tokens: 10, role: 'administrador' },
    { id: 2, username: 'curator1', tokens: 5, role: 'usuario' },
    { id: 3, username: 'artist1', tokens: 1, role: 'usuario' },
    { id: 4, username: 'artist_nopobre', tokens: 0, role: 'usuario' }
  ];
  dbState.submissions = [];
  dbState.nextSubId = 1;
  dbState.failNextError = false;
});

describe('Envío de Canciones (Modo Artista)', () => {
  test('Debe permitir envío con URL válida de Spotify', async () => {
    const token = createToken(3, 'usuario');
    const response = await request(app)
      .post('/api/submissions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        trackUrl: 'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT',
        playlistId: 1,
        trackName: 'Mi nueva canción'
      });

    expect(response.status).toBe(201);
    expect(response.body.message).toBe('Canción enviada exitosamente');
    expect(response.body.tokensRestantes).toBe(0);
  });

  test('Debe rechazar URL con intento de inyección SQL', async () => {
    const token = createToken(3, 'usuario');
    const response = await request(app)
      .post('/api/submissions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        trackUrl: "https://open.spotify.com/track/4cOd' OR '1'='1' --",
        playlistId: 1
      });

    // La URL no coincide con el patrón estricto /track/ -> validación 400
    expect(response.status).toBe(400);
  });

  test('Debe rechazar URL con intento de XSS', async () => {
    const token = createToken(3, 'usuario');
    const response = await request(app)
      .post('/api/submissions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        trackUrl: "https://open.spotify.com/track/<script>alert('xss')</script>",
        playlistId: 1,
        trackName: "<script>alert('XSS')</script>"
      });

    expect(response.status).toBe(400);
  });

  test('Debe rechazar petición sin token (no autenticado)', async () => {
    const response = await request(app)
      .post('/api/submissions')
      .send({
        trackUrl: 'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT',
        playlistId: 1
      });

    expect(response.status).toBe(401);
  });

  test('Debe rechazar envío sin tokens suficientes', async () => {
    // El artista id=4 tiene 0 tokens (límite insuficiente)
    const token = createToken(4, 'usuario');
    const response = await request(app)
      .post('/api/submissions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        trackUrl: 'https://open.spotify.com/track/7aBcDef12345',
        playlistId: 1
      });

    expect(response.status).toBe(402);
  });

  test('Debe rechazar envío a una playlist que no existe', async () => {
    const token = createToken(3, 'usuario');
    const response = await request(app)
      .post('/api/submissions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        trackUrl: 'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT',
        playlistId: 999
      });

    expect(response.status).toBe(404);
  });

  test('Debe devolver 500 si falla la base de datos al enviar', async () => {
    dbState.failNextError = true;
    const token = createToken(3, 'usuario');
    const response = await request(app)
      .post('/api/submissions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        trackUrl: 'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT',
        playlistId: 1
      });

    expect(response.status).toBe(500);
  });

  test('Debe rechazar envío con usuario autenticado que no existe en BD (404)', async () => {
    const token = createToken(999, 'usuario');
    const response = await request(app)
      .post('/api/submissions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        trackUrl: 'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT',
        playlistId: 1
      });

    expect(response.status).toBe(404);
    expect(response.body.error).toBe('Usuario no encontrado');
  });

  test('Debe rechazar envío a la propia playlist del artista', async () => {
    // Artista id=2 es dueño de la playlist 1; envía a su propia playlist (denegado)
    const token = createToken(2, 'usuario');
    const response = await request(app)
      .post('/api/submissions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        trackUrl: 'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT',
        playlistId: 1
      });

    expect(response.status).toBe(400);
  });

  test('Debe rechazar envío duplicado del mismo track a la misma playlist (409)', async () => {
    // Inyectar una submission previa del artista 3 a la playlist 1
    dbState.submissions.push({
      id: 100,
      artist_id: 3,
      playlist_id: 1,
      track_url: 'https://open.spotify.com/track/abcdEFGHIJ',
      track_name: 'previo',
      status: 'pendiente'
    });

    const token = createToken(3, 'usuario');
    const response = await request(app)
      .post('/api/submissions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        trackUrl: 'https://open.spotify.com/track/abcdEFGHIJ',
        playlistId: 1
      });

    expect(response.status).toBe(409);
    expect(response.body.error).toContain('ya fue enviada');
  });
});

describe('Aceptar Propuestas (Modo Curador)', () => {
  beforeEach(async () => {
    // Resetear estado
    dbState.users = [
      { id: 1, username: 'admin', tokens: 10, role: 'administrador' },
      { id: 2, username: 'curator1', tokens: 5, role: 'usuario' },
      { id: 3, username: 'artist1', tokens: 1, role: 'usuario' },
      { id: 4, username: 'artist_nopobre', tokens: 0, role: 'usuario' }
    ];
    dbState.playlists = [
      { id: 1, user_id: 2, spotify_id: 'playlistA', name: 'Vibraciones', followers: 1200 }
    ];
    dbState.submissions = [
      {
        id: 1,
        artist_id: 3,
        playlist_id: 1,
        track_url: 'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT',
        track_name: 'Mi canción',
        status: 'pendiente'
      }
    ];
    dbState.nextSubId = 2;
  });

  test('El curador dueño debe aceptar la propuesta y sincronizarla a Spotify (el token se consume)', async () => {
    const { addTracksToPlaylist } = require('../config/spotify');

    const token = createToken(2, 'usuario');
    const response = await request(app)
      .post('/api/submissions/1/accept')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.synced).toBe(true);
    expect(response.body.message).toBe(
      'Propuesta aceptada: canción agregada a tu playlist de Spotify'
    );
    // El token ya se descontó al enviar; aceptar lo CONSUME, no devuelve nada
    expect(dbState.users.find((u) => u.id === 3).tokens).toBe(1);
    expect(dbState.users.find((u) => u.id === 2).tokens).toBe(5);

    // El sync real llamó a la API de Spotify con la playlist y el track correctos
    expect(addTracksToPlaylist).toHaveBeenCalledWith(
      'tok_curator',
      'playlistA',
      'spotify:track:4cOdK2wGLETKBW3PvgPWqT'
    );
  });

  test('Debe rechazar aceptación si no es el dueño de la playlist', async () => {
    // El usuario id=3 NO es el dueño de la playlist 1 (es el artista)
    const token = createToken(3, 'usuario');
    const response = await request(app)
      .post('/api/submissions/1/accept')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(403);
  });

  test('Debe rechazar aceptación si la propuesta no existe (404)', async () => {
    const token = createToken(2, 'usuario');
    const response = await request(app)
      .post('/api/submissions/999/accept')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(404);
  });

  test('Debe rechazar aceptación con ID inválido (400)', async () => {
    const token = createToken(2, 'usuario');
    const response = await request(app)
      .post('/api/submissions/abc/accept')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(400);
  });

  test('Debe rechazar aceptar la misma propuesta dos veces (400) - ya procesada', async () => {
    const token = createToken(2, 'usuario');

    // Primera aceptación exitosa
    const first = await request(app)
      .post('/api/submissions/1/accept')
      .set('Authorization', `Bearer ${token}`);
    expect(first.status).toBe(200);

    // Segunda aceptación de la misma propuesta
    const second = await request(app)
      .post('/api/submissions/1/accept')
      .set('Authorization', `Bearer ${token}`);

    expect(second.status).toBe(400);
    expect(second.body.error).toContain('ya fue procesada');
  });
});

describe('Rechazar Propuestas (Modo Curador)', () => {
  beforeEach(async () => {
    // Resetear estado
    dbState.users = [
      { id: 1, username: 'admin', tokens: 10, role: 'administrador' },
      { id: 2, username: 'curator1', tokens: 5, role: 'usuario' },
      { id: 3, username: 'artist1', tokens: 1, role: 'usuario' },
      { id: 4, username: 'artist_nopobre', tokens: 0, role: 'usuario' }
    ];
    dbState.playlists = [
      { id: 1, user_id: 2, spotify_id: 'playlistA', name: 'Vibraciones', followers: 1200 }
    ];
    dbState.submissions = [
      {
        id: 1,
        artist_id: 3,
        playlist_id: 1,
        track_url: 'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT',
        track_name: 'Mi canción',
        status: 'pendiente'
      }
    ];
    dbState.nextSubId = 2;
  });

  test('El curador dueño rechaza la propuesta y se devuelve 1 token al artista', async () => {
    const token = createToken(2, 'usuario');
    const response = await request(app)
      .post('/api/submissions/1/reject')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.message).toContain('devolvió 1 token al artista');
    // El artista (id 3) recupera el token que gastó al enviar
    expect(dbState.users.find((u) => u.id === 3).tokens).toBe(2);
    // El curador (id 2) no pierde nada
    expect(dbState.users.find((u) => u.id === 2).tokens).toBe(5);
    expect(dbState.submissions.find((s) => s.id === 1).status).toBe('rechazada');
  });

  test('Debe 403 si quien rechaza no es el dueño de la playlist', async () => {
    const token = createToken(3, 'usuario');
    const response = await request(app)
      .post('/api/submissions/1/reject')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(403);
  });

  test('Debe rechazar si la propuesta no existe (404)', async () => {
    const token = createToken(2, 'usuario');
    const response = await request(app)
      .post('/api/submissions/999/reject')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(404);
  });

  test('Debe rechazar con ID inválido (400)', async () => {
    const token = createToken(2, 'usuario');
    const response = await request(app)
      .post('/api/submissions/abc/reject')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(400);
  });

  test('Debe rechazar rechazar la misma propuesta dos veces (400) - ya procesada', async () => {
    const token = createToken(2, 'usuario');

    const first = await request(app)
      .post('/api/submissions/1/reject')
      .set('Authorization', `Bearer ${token}`);
    expect(first.status).toBe(200);

    const second = await request(app)
      .post('/api/submissions/1/reject')
      .set('Authorization', `Bearer ${token}`);

    expect(second.status).toBe(400);
    expect(second.body.error).toContain('ya fue procesada');
  });

  test('Debe 500 si falla la base de datos al rechazar', async () => {
    dbState.failNextError = true;
    const token = createToken(2, 'usuario');
    const response = await request(app)
      .post('/api/submissions/1/reject')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(500);
  });
});

describe('Listar Mis Propuestas (Artista)', () => {
  beforeEach(() => {
    dbState.users = [
      { id: 3, username: 'artist1', tokens: 1, role: 'usuario' }
    ];
    dbState.playlists = [
      { id: 1, user_id: 2, spotify_id: 'playlistA', name: 'Vibraciones', followers: 1200 }
    ];
    dbState.submissions = [
      {
        id: 1,
        artist_id: 3,
        playlist_id: 1,
        track_url: 'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT',
        track_name: 'Mi canción',
        status: 'pendiente'
      }
    ];
    dbState.nextSubId = 2;
  });

  test('Debe listar las propuestas del artista autenticado', async () => {
    const token = createToken(3, 'usuario');
    const response = await request(app)
      .get('/api/submissions')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.submissions.length).toBe(1);
    expect(response.body.submissions[0].playlist_name).toBe('Vibraciones');
  });

  test('Debe requerir autenticación para listar propuestas', async () => {
    const response = await request(app)
      .get('/api/submissions');

    expect(response.status).toBe(401);
  });

  test('Debe devolver 500 si falla la base de datos al listar', async () => {
    dbState.failNextError = true;
    const token = createToken(3, 'usuario');
    const response = await request(app)
      .get('/api/submissions')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(500);
  });
});
