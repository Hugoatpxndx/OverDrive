// ============================================================
// Controlador de integración con Spotify (OAuth 2.0)
// Flujo: Auth URL -> Callback -> Importar playlists
// ============================================================
const crypto = require('crypto');
const { executeQuery } = require('../config/db');
const spotify = require('../config/spotify');

// Estados OAuth activos en memoria: state -> { userId, createdAt }
const oauthStates = new Map();
const STATE_TTL = 10 * 60 * 1000; // 10 minutos

// Limpiar estados caducados (previene acumulación en memoria)
const cleanupStates = () => {
  const now = Date.now();
  for (const [state, data] of oauthStates.entries()) {
    if (now - data.createdAt > STATE_TTL) {
      oauthStates.delete(state);
    }
  }
};

// GET /api/spotify/auth-url — genera la URL de autorización de Spotify
const getAuthUrl = async (req, res) => {
  cleanupStates();
  if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
    return res.status(503).json({
      error: 'La integración con Spotify no está configurada (faltan SPOTIFY_CLIENT_ID/SECRET)'
    });
  }
  const state = crypto.randomBytes(24).toString('hex');
  oauthStates.set(state, { userId: req.user.id, createdAt: Date.now() });

  return res.status(200).json({ authUrl: spotify.buildAuthUrl(state) });
};

// GET /api/spotify/callback — Spotify redirige aquí tras autorizar
const spotifyCallback = async (req, res) => {
  const { code, state } = req.query;
  const frontendOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';
  const redirect = (status) =>
    res.redirect(`${frontendOrigin}/dashboard?spotify=${status}`);

  try {
    const stateData = oauthStates.get(state);
    oauthStates.delete(state);

    // Validación del state (anti-CSRF) y presencia del code
    if (!stateData || !code) {
      return redirect('error');
    }

    const tokens = await spotify.exchangeCode(code);
    if (!tokens.refresh_token) {
      return redirect('error');
    }

    // Guardar tokens del curador en su cuenta de OverDrive
    await executeQuery(
      `UPDATE users
       SET spotify_access_token = ?, spotify_refresh_token = ?, spotify_connected_at = NOW()
       WHERE id = ?`,
      [tokens.access_token, tokens.refresh_token, stateData.userId]
    );

    return redirect('connected');
  } catch (error) {
    console.error('Error en callback Spotify:', error.message);
    return redirect('error');
  }
};

// Devuelve un access token válido, renovándolo con el refresh si es necesario
const fetchWithRefresh = async (user, fetchFn) => {
  try {
    return await fetchFn(user.spotify_access_token);
  } catch (error) {
    // Solo reintentamos si el token caducó (401) y existe refresh token
    if (error.response?.status !== 401 || !user.spotify_refresh_token) {
      throw error;
    }
    const tokens = await spotify.refreshAccessToken(user.spotify_refresh_token);
    await executeQuery(
      'UPDATE users SET spotify_access_token = ? WHERE id = ?',
      [tokens.access_token, user.id]
    );
    return await fetchFn(tokens.access_token);
  }
};

// GET /api/spotify/playlists — importa las playlists del Curador conectado
const importPlaylists = async (req, res) => {
  const userId = req.user.id;
  try {
    const rows = await executeQuery(
      'SELECT spotify_access_token, spotify_refresh_token FROM users WHERE id = ?',
      [userId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    const user = rows[0];

    if (!user.spotify_access_token && !user.spotify_refresh_token) {
      return res.status(400).json({ error: 'Primero conecta tu cuenta de Spotify' });
    }

    const playlists = await fetchWithRefresh(user, spotify.getMyPlaylists);

    let importedCount = 0;
    for (const p of playlists) {
      const spotifyId = (p.id || '').slice(0, 80);
      const name = (p.name || 'Playlist sin nombre').slice(0, 200);
      const spotifyUrl = (
        p.external_urls?.spotify ||
        `https://open.spotify.com/playlist/${spotifyId}`
      ).slice(0, 500);

      // El campo followers no viene en /me/playlists: se consulta aparte.
      let followers = Number.isInteger(p.followers?.total) ? p.followers.total : 0;
      try {
        followers = await fetchWithRefresh(
          user,
          (tok) => spotify.getPlaylistFollowers(tok, spotifyId)
        );
      } catch (err) {
        // Si falla la consulta individual, se conserva el valor anterior (0)
      }

      await executeQuery(
        `INSERT INTO playlists (user_id, spotify_id, name, followers, spotify_url)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           name = VALUES(name),
           followers = VALUES(followers),
           spotify_url = VALUES(spotify_url)`,
        [userId, spotifyId, name, followers, spotifyUrl]
      );
      importedCount += 1;
    }

    return res.status(200).json({
      message: 'Playlists importadas exitosamente',
      count: importedCount
    });
  } catch (error) {
    console.error('Error al importar playlists:', error.message);
    return res.status(500).json({
      error: 'No se pudieron importar las playlists. Revisa la conexión con Spotify.'
    });
  }
};

// GET /api/spotify/status — indica si el Curador tiene Spotify conectado
const getStatus = async (req, res) => {
  try {
    const rows = await executeQuery(
      'SELECT spotify_access_token, spotify_refresh_token, spotify_connected_at FROM users WHERE id = ?',
      [req.user.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    const row = rows[0];
    const connected = Boolean(row.spotify_refresh_token || row.spotify_access_token);
    return res.json({
      connected,
      connectedAt: row.spotify_connected_at || null
    });
  } catch (error) {
    console.error('Error al consultar estado de Spotify:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// POST /api/spotify/disconnect — desvincula la cuenta de Spotify del Curador
const disconnectSpotify = async (req, res) => {
  try {
    await executeQuery(
      `UPDATE users
       SET spotify_access_token = NULL, spotify_refresh_token = NULL, spotify_connected_at = NULL
       WHERE id = ?`,
      [req.user.id]
    );
    return res.status(200).json({ message: 'Cuenta de Spotify desconectada' });
  } catch (error) {
    console.error('Error al desconectar Spotify:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = {
  getAuthUrl,
  spotifyCallback,
  importPlaylists,
  getStatus,
  disconnectSpotify
};