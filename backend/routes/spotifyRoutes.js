const express = require('express');
const { authenticate } = require('../middlewares/auth');
const {
  getAuthUrl,
  spotifyCallback,
  importPlaylists,
  getStatus,
  disconnectSpotify
} = require('../controllers/spotifyController');

const router = express.Router();

// RUTA PÚBLICA: Spotify redirige el navegador aquí tras autorizar el OAuth.
// No lleva token JWT (el state valida la petición anti-CSRF).
router.get('/callback', spotifyCallback);

// Rutas protegidas con JWT
router.get('/auth-url', authenticate, getAuthUrl);
router.get('/status', authenticate, getStatus);
router.post('/disconnect', authenticate, disconnectSpotify);
router.get('/playlists', authenticate, importPlaylists);

module.exports = router;