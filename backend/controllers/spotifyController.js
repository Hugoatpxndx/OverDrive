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

// Ejecuta tareas con un límite de concurrencia (evita saturar la API
// con 50+ llamadas simultáneas, pero no hacerlas en serie).
const mapWithConcurrency = async (items, limit, fn) => {
  const results = new Array(items.length);
  let cursor = 0;
  const worker = async () => {
    while (cursor < items.length) {
      const idx = cursor++;
      results[idx] = await fn(items[idx], idx);
    }
  };
  const workers = Array.from({ length: Math.min(limit, items.length) }, worker);
  await Promise.all(workers);
  return results;
};

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

    // Identificar la cuenta de Spotify (id de /v1/me) para impedir que la
    // misma cuenta quede vinculada a dos usuarios de OverDrive.
    // Si la llamada a /me falla (red), se vincula igual pero sin identidad
    // (spotify_user_id NULL) para no bloquear la conexión por un hipo de red.
    let spotifyUserId = null;
    try {
      const me = await spotify.getSpotifyUser(tokens.access_token);
      spotifyUserId = (me && (me.id || me.email)) || null;
    } catch (meErr) {
      console.error('No se pudo identificar la cuenta de Spotify al vincular:', meErr.message);
    }

    if (spotifyUserId) {
      const linkedRows = await executeQuery(
        'SELECT id, username FROM users WHERE spotify_user_id = ? AND id <> ?',
        [spotifyUserId, stateData.userId]
      );
      if (linkedRows.length > 0) {
        console.warn(
          `Rechazado: la cuenta de Spotify ${spotifyUserId} ya está vinculada al usuario ` +
          `"${linkedRows[0].username}" (id ${linkedRows[0].id})`
        );
        return redirect('linked');
      }
    }

    // Guardar tokens del curador en su cuenta de OverDrive
    await executeQuery(
      `UPDATE users
       SET spotify_access_token = ?, spotify_refresh_token = ?, spotify_connected_at = NOW(),
           spotify_user_id = COALESCE(?, spotify_user_id)
       WHERE id = ?`,
      [tokens.access_token, tokens.refresh_token, spotifyUserId, stateData.userId]
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
      'SELECT id, spotify_access_token, spotify_refresh_token, spotify_user_id FROM users WHERE id = ?',
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

    // /me/playlists incluye TAMBIÉN las playlists que el usuario sigue/tiene
    // en su biblioteca pero no creó. Solo importamos las que el propio
    // usuario creó, comparando el owner de cada playlist con su identidad
    // real de Spotify (/me). Si no tenemos aún la identidad guardada, se
    // consulta aquí y se persiste.
    let spotifyOwnerId = user.spotify_user_id || null;
    let ownerKnown = true;
    if (!spotifyOwnerId) {
      try {
        const me = await fetchWithRefresh(user, spotify.getSpotifyUser);
        spotifyOwnerId = (me && (me.id || me.email)) || null;
        if (spotifyOwnerId) {
          await executeQuery(
            'UPDATE users SET spotify_user_id = ? WHERE id = ?',
            [spotifyOwnerId, userId]
          );
        }
      } catch (meErr) {
        console.error('No se pudo identificar al dueño de las playlists:', meErr.message);
        ownerKnown = false;
      }
    }

    const ownedPlaylists = playlists.filter((p) => {
      // Si no pudimos identificar al dueño (red caída), importamos todo
      // (comportamiento anterior) para no bloquear la importación.
      if (!ownerKnown || !spotifyOwnerId) return true;
      return p.owner?.id === spotifyOwnerId;
    });

    // Los followers se consultan por playlist; en paralelo (con límite) para
    // no hacer N llamadas en serie. Si una falla, se conserva 0 (no bloquea).
    const followersList = await mapWithConcurrency(ownedPlaylists, 5, async (p) => {
      const spotifyId = (p.id || '').slice(0, 80);
      try {
        const followers = Number.isInteger(p.followers?.total)
          ? p.followers.total
          : await fetchWithRefresh(
              user,
              (tok) => spotify.getPlaylistFollowers(tok, spotifyId)
            );
        return { spotifyId, followers };
      } catch (err) {
        return { spotifyId, followers: 0 };
      }
    });
    const followersByPlaylist = new Map(
      followersList.map((f) => [f.spotifyId, f.followers])
    );

    let importedCount = 0;
    for (const p of ownedPlaylists) {
      const spotifyId = (p.id || '').slice(0, 80);
      const name = (p.name || 'Playlist sin nombre').slice(0, 200);
      const spotifyUrl = (
        p.external_urls?.spotify ||
        `https://open.spotify.com/playlist/${spotifyId}`
      ).slice(0, 500);

      const followers = followersByPlaylist.get(spotifyId) || 0;

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
       SET spotify_access_token = NULL, spotify_refresh_token = NULL,
           spotify_connected_at = NULL, spotify_user_id = NULL
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
  disconnectSpotify,
  fetchWithRefresh
};