const { executeQuery, getConnection } = require('../config/db');
const spotify = require('../config/spotify');
const { fetchWithRefresh } = require('./spotifyController');

// Sanitización de cadenas para prevenir XSS
const sanitizeString = (value) => {
  if (typeof value !== 'string') return '';
  return value
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/`/g, '&#96;')
    .trim();
};

// Quita los parámetros de seguimiento (si=...) que añade Spotify al copiar
// un enlace, para guardar la URL limpia y evitar duplicados.
const normalizeSpotifyUrl = (url) => {
  try {
    const parsed = new URL(url);
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString();
  } catch (err) {
    return url;
  }
};

// Extraer el ID del track de Spotify desde la URL
const extractSpotifyTrackId = (url) => {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split('/').filter(Boolean);
    const trackIndex = parts.indexOf('track');
    if (trackIndex !== -1 && parts[trackIndex + 1]) {
      return parts[trackIndex + 1];
    }
    // Patrón: open.spotify.com/track/XXXXXX
    const match = url.match(/\/track\/([a-zA-Z0-9]{10,30})/);
    return match ? match[1] : null;
  } catch (err) {
    return null;
  }
};

// Envío de propuesta musical (Modo Artista)
// Gasta 1 token al enviar
const submitSong = async (req, res) => {
  const connection = await getConnection();
  try {
    const artistId = req.user.id;
    const trackUrl = sanitizeString(req.body.trackUrl);
    const playlistId = parseInt(req.body.playlistId, 10);
    const trackName = sanitizeString(req.body.trackName || '');

    // Validación estricta de la URL del track (inicio a fin)
    // Debe ser una URL de Spotify que contenga /track/ con ID alfanumérico
    // (se admite la query ?si=... que añade Spotify al copiar).
    const urlRegex = /^https?:\/\/open\.spotify\.com\/track\/[a-zA-Z0-9]{6,40}(\?[a-zA-Z0-9&=._%+-]*)?$/;
    if (!urlRegex.test(trackUrl)) {
      return res.status(400).json({ error: 'URL inválida: debe ser un enlace de track de Spotify (open.spotify.com/track/...)' });
    }

    // Guardar la URL limpia (sin ?si=...) para evitar duplicados
    const cleanTrackUrl = normalizeSpotifyUrl(trackUrl);

    // Validar ID extraído
    const spotifyTrackId = extractSpotifyTrackId(trackUrl);
    if (!spotifyTrackId) {
      return res.status(400).json({ error: 'URL de track no válida' });
    }

    if (isNaN(playlistId) || playlistId <= 0) {
      return res.status(400).json({ error: 'ID de playlist inválido' });
    }

    // Verificar que el artista tiene tokens suficientes
    const [artistRows] = await connection.execute(
      'SELECT id, tokens FROM users WHERE id = ?',
      [artistId]
    );
    if (artistRows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    const artist = artistRows[0];
    if (artist.tokens < 1) {
      return res.status(402).json({ error: 'Tokens insuficientes: necesitas al menos 1 token' });
    }

    // Verificar que la playlist existe y obtener el dueño (curador)
    const [playlistRows] = await connection.execute(
      'SELECT id, user_id FROM playlists WHERE id = ?',
      [playlistId]
    );
    if (playlistRows.length === 0) {
      return res.status(404).json({ error: 'Playlist no encontrada' });
    }

    const playlist = playlistRows[0];

    // No permitir que un artista envíe a su propia playlist
    if (playlist.user_id === artistId) {
      return res.status(400).json({ error: 'No puedes enviar una propuesta a tu propia playlist' });
    }

    // Nota: No usar transacciones largas aquí porque tomaría el lock de la wallet.
    // En su lugar, hacemos update atómico: UPDATE ... SET tokens = tokens - 1
    // WHERE tokens >= 1 (condición protegida contra race conditions)
    const [updateResult] = await connection.execute(
      'UPDATE users SET tokens = tokens - 1 WHERE id = ? AND tokens >= 1',
      [artistId]
    );

    if (updateResult.affectedRows === 0) {
      return res.status(402).json({ error: 'Tokens insuficientes: necesitas al menos 1 token' });
    }

    // Insertar la submission usando prepared statement
    const [insertResult] = await connection.execute(
      'INSERT INTO submissions (artist_id, playlist_id, track_url, track_name) VALUES (?, ?, ?, ?)',
      [artistId, playlistId, cleanTrackUrl, trackName]
    );

    // Obtener el estado actualizado de tokens
    const [updatedArtist] = await connection.execute(
      'SELECT tokens FROM users WHERE id = ?',
      [artistId]
    );

    return res.status(201).json({
      message: 'Canción enviada exitosamente',
      submissionId: insertResult.insertId,
      spotifyTrackId,
      costoToken: 1,
      tokensRestantes: updatedArtist[0].tokens
    });
  } catch (error) {
    console.error('Error en envío de canción:', error.code, error.sqlMessage);
    // Manejo específico para violación de constraint (duplicado o CHECK tokens)
    if (error.code === 'ER_DUP_ENTRY') {
      // El envío duplicado fue rechazado, pero el token ya se descontó antes
      // del INSERT: lo reembolsamos para que el artista no pierda su token.
      await connection.execute(
        'UPDATE users SET tokens = LEAST(tokens + 1, 10) WHERE id = ?',
        [artistId]
      );
      return res.status(409).json({ error: 'Esta canción ya fue enviada a esta playlist (token reembolsado)' });
    }
    if (error.code === 'ER_CHECK_CONSTRAINT_VIOLATED') {
      return res.status(400).json({ error: 'Límite de tokens alcanzado (máximo 10)' });
    }
    return res.status(500).json({ error: 'Error interno del servidor' });
  } finally {
    connection.release();
  }
};

// Aceptar propuesta (Modo Curador) - El artista autor gana 1 token
const acceptSubmission = async (req, res) => {
  const connection = await getConnection();
  try {
    const submissionId = parseInt(req.params.id, 10);
    const curatorId = req.user.id;

    if (isNaN(submissionId) || submissionId <= 0) {
      return res.status(400).json({ error: 'ID de propuesta inválido' });
    }

    // Obtener la submission junto con su playlist para verificar propiedad
    const [submissionRows] = await connection.execute(
      `SELECT s.id, s.status, s.playlist_id, s.track_url,
              p.user_id AS playlist_owner, p.spotify_id AS playlist_spotify_id
       FROM submissions s
       JOIN playlists p ON p.id = s.playlist_id
       WHERE s.id = ?`,
      [submissionId]
    );
    if (submissionRows.length === 0) {
      return res.status(404).json({ error: 'Propuesta no encontrada' });
    }

    const submission = submissionRows[0];

    // Solo el dueño de la playlist (curador) puede aceptar
    if (submission.playlist_owner !== curatorId) {
      return res.status(403).json({ error: 'No tienes permiso para aceptar esta propuesta' });
    }

    if (submission.status !== 'pendiente') {
      return res.status(400).json({ error: 'La propuesta ya fue procesada' });
    }

    // Sincronización real con Spotify: agrega la canción a la playlist del
    // curador al aceptar. Si el curador no tiene Spotify conectado o la API
    // falla, la aprobación continúa de todos modos (soft fail) y se informa.
    let synced = false;
    try {
      const [curatorRows] = await connection.execute(
        'SELECT id, spotify_access_token, spotify_refresh_token FROM users WHERE id = ?',
        [curatorId]
      );
      const curator = curatorRows[0] || null;
      const trackId = extractSpotifyTrackId(submission.track_url || '');
      if (
        curator &&
        (curator.spotify_access_token || curator.spotify_refresh_token) &&
        submission.playlist_spotify_id &&
        trackId
      ) {
        try {
          await fetchWithRefresh(curator, (tok) =>
            spotify.addTracksToPlaylist(
              tok,
              submission.playlist_spotify_id,
              `spotify:track:${trackId}`
            )
          );
          synced = true;
        } catch (syncErr) {
          const detail =
            syncErr.response?.data?.error?.message ||
            syncErr.response?.data?.error?.reason ||
            syncErr.message;
          console.error(
            'No se pudo agregar la canción a la playlist de Spotify:',
            detail,
            syncErr.response ? ` (HTTP ${syncErr.response.status})` : ''
          );
        }
      }
    } catch (syncErr) {
      console.error('No se pudo consultar la conexión de Spotify del curador:', syncErr.message);
    }

    // Marcar como aprobada (registrando si se sincronizó a Spotify)
    const [updateResult] = await connection.execute(
      'UPDATE submissions SET status = ?, handled_by = ?, spotify_synced = ? WHERE id = ? AND status = ?',
      ['aprobada', curatorId, synced ? 1 : 0, submissionId, 'pendiente']
    );

    if (updateResult.affectedRows === 0) {
      return res.status(400).json({ error: 'La propuesta ya fue procesada' });
    }

    // Otorgar 1 token al artista autor de la propuesta aceptada,
    // respetando el tope máximo de 10. Así el artista recupera el token
    // que gastó al enviar y la aprobación es su recompensa.
    const [tokenResult] = await connection.execute(
      'UPDATE users SET tokens = LEAST(tokens + 1, 10) WHERE id = ?',
      [submission.artist_id]
    );

    if (tokenResult.affectedRows === 0) {
      return res.status(500).json({ error: 'Error al actualizar tokens' });
    }

    const message = synced
      ? 'Propuesta aceptada: canción agregada a tu playlist de Spotify (+1 token para el artista)'
      : 'Propuesta aceptada: +1 token para el artista. La canción NO se agregó a Spotify — desconecta y vuelve a conectar tu cuenta para conceder permisos de escritura.';

    return res.status(200).json({
      message,
      submissionId,
      synced
    });
  } catch (error) {
    console.error('Error al aceptar propuesta:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  } finally {
    connection.release();
  }
};

// Listar mis propuestas como artista
const listMySubmissions = async (req, res) => {
  try {
    const userId = req.user.id;
    const rows = await executeQuery(
      `SELECT s.id, s.track_url, s.track_name, s.status, s.spotify_synced, s.created_at,
              p.name AS playlist_name
       FROM submissions s
       JOIN playlists p ON p.id = s.playlist_id
       WHERE s.artist_id = ?
       ORDER BY s.created_at DESC`,
      [userId]
    );

    return res.json({ submissions: rows });
  } catch (error) {
    console.error('Error al listar propuestas:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Listar propuestas que recibe el Curador (para sus playlists)
const listCuratorSubmissions = async (req, res) => {
  try {
    const userId = req.user.id;
    const rows = await executeQuery(
      `SELECT s.id, s.track_url, s.track_name, s.status, s.spotify_synced, s.created_at,
              p.name AS playlist_name, u.username AS artist
       FROM submissions s
       JOIN playlists p ON p.id = s.playlist_id
       JOIN users u ON u.id = s.artist_id
       WHERE p.user_id = ?
       ORDER BY s.created_at DESC`,
      [userId]
    );

    return res.json({ submissions: rows });
  } catch (error) {
    console.error('Error al listar propuestas del curador:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { submitSong, acceptSubmission, listMySubmissions, listCuratorSubmissions };
