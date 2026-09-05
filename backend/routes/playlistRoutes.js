const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticate } = require('../middlewares/auth');
const { listPlaylists, createPlaylist } = require('../controllers/playlistController');

const router = express.Router();

// Todas las rutas de playlists requieren autenticación JWT
router.use(authenticate);

// GET /api/playlists — listar playlists disponibles (modo Artista y Admin)
router.get('/', listPlaylists);

// POST /api/playlists — crear playlist manualmente (Modo Curador)
router.post(
  '/',
  [
    body('name')
      .trim()
      .notEmpty()
      .withMessage('Nombre de la playlist es obligatorio')
      .isLength({ max: 200 })
      .withMessage('Nombre demasiado largo')
      .escape(),
    body('spotifyUrl')
      .trim()
      .notEmpty()
      .withMessage('URL de la playlist es obligatoria')
      .isLength({ max: 500 })
      .withMessage('URL demasiado larga')
      .matches(/^https?:\/\/open\.spotify\.com\/playlist\/[a-zA-Z0-9]{10,40}$/)
      .withMessage('Debe ser una URL válida de playlist de Spotify'),
    body('followers')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Seguidores debe ser un número no negativo')
  ],
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  },
  createPlaylist
);

module.exports = router;