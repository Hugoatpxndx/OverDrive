const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { authenticate } = require('../middlewares/auth');
const {
  submitSong,
  acceptSubmission,
  listMySubmissions,
  listCuratorSubmissions
} = require('../controllers/submissionController');

const router = express.Router();

// Todas las rutas de submissions requieren autenticación JWT
router.use(authenticate);

// POST /api/submissions - Envío de canción (Modo Artista)
router.post(
  '/',
  [
    body('trackUrl')
      .trim()
      .notEmpty()
      .withMessage('URL del track es obligatoria')
      .isLength({ max: 500 })
      .withMessage('URL demasiado larga')
      .matches(/^https?:\/\/open\.spotify\.com\/track\/[a-zA-Z0-9]{6,40}(\?[a-zA-Z0-9&=._%+-]*)?$/)
      .withMessage('Debe ser una URL válida de track de Spotify'),
    body('playlistId')
      .isInt({ min: 1 })
      .withMessage('ID de playlist inválido'),
    body('trackName')
      .optional()
      .trim()
      .isLength({ max: 200 })
      .withMessage('Nombre de track demasiado largo')
      .escape()
  ],
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  },
  submitSong
);

// GET /api/submissions - Listar mis propuestas (Artista)
router.get('/', listMySubmissions);

// GET /api/submissions/curator - Listar propuestas recibidas (Curador)
router.get('/curator', listCuratorSubmissions);

// POST /api/submissions/:id/accept - Aceptar propuesta (Modo Curador)
router.post(
  '/:id/accept',
  [
    param('id').isInt({ min: 1 }).withMessage('ID de propuesta inválido')
  ],
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  },
  acceptSubmission
);

module.exports = router;
