// ============================================================
// Controlador de Playlists
// Listar playlists disponibles y alta manual (Modo Curador)
// ============================================================
const { executeQuery } = require('../config/db');

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

// Extraer el ID de playlist desde la URL de Spotify
const extractSpotifyPlaylistId = (url) => {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split('/').filter(Boolean);
    const idx = parts.indexOf('playlist');
    if (idx !== -1 && parts[idx + 1]) {
      return parts[idx + 1];
    }
  } catch (err) {
    // Si la URL no parsea, seguimos con la regex
  }
  const match = url.match(/\/playlist\/([a-zA-Z0-9]{10,40})/);
  return match ? match[1] : null;
};

// GET /api/playlists — listar playlists disponibles (artistas y administración)
const listPlaylists = async (req, res) => {
  try {
    const rows = await executeQuery(
      `SELECT p.id, p.name, p.followers, p.spotify_url, p.created_at,
              p.user_id AS owner_id, u.username AS owner
       FROM playlists p
       JOIN users u ON u.id = p.user_id
       ORDER BY p.followers DESC, p.name ASC`
    );
    return res.json({ playlists: rows });
  } catch (error) {
    console.error('Error al listar playlists:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// POST /api/playlists — crear playlist manualmente (Modo Curador)
const createPlaylist = async (req, res) => {
  try {
    const name = sanitizeString(req.body.name);
    const spotifyUrl = sanitizeString(req.body.spotifyUrl);
    const followers = parseInt(req.body.followers, 10) || 0;

    // Validación estricta: solo URLs reales de playlist de Spotify
    const urlRegex = /^https?:\/\/open\.spotify\.com\/playlist\/[a-zA-Z0-9]{10,40}$/;
    if (!urlRegex.test(spotifyUrl)) {
      return res.status(400).json({
        error: 'URL inválida: debe ser un enlace de playlist de Spotify (open.spotify.com/playlist/...)'
      });
    }
    const spotifyId = extractSpotifyPlaylistId(spotifyUrl);
    if (!spotifyId) {
      return res.status(400).json({ error: 'URL de playlist no válida' });
    }

    // Prepared statement + upsert (nombre/seguidores se actualizan si ya existe)
    await executeQuery(
      `INSERT INTO playlists (user_id, spotify_id, name, followers, spotify_url)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         name = VALUES(name),
         followers = VALUES(followers)`,
      [req.user.id, spotifyId, name, followers, spotifyUrl]
    );

    return res.status(201).json({ message: 'Playlist registrada exitosamente' });
  } catch (error) {
    console.error('Error al crear playlist:', error.code, error.sqlMessage);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { listPlaylists, createPlaylist };