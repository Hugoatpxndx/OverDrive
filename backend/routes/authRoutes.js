const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticate } = require('../middlewares/auth');
const { register, login, verifyEmail, me } = require('../controllers/authController');

const router = express.Router();

// GET /api/auth/me - Datos actuales del usuario autenticado (contador de tokens al día)
router.get('/me', authenticate, me);

// POST /api/auth/verify - Verificar el email con el código de 6 dígitos
router.post(
  '/verify',
  [
    body('code').trim().isLength({ min: 6, max: 6 }).withMessage('El código debe tener 6 dígitos')
  ],
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  },
  authenticate,
  verifyEmail
);

// Ruta POST /api/auth/register
// Validación estricta de inputs (express-validator)
router.post(
  '/register',
  [
    body('username')
      .trim()
      .isLength({ min: 3, max: 20 })
      .withMessage('Usuario debe tener entre 3 y 20 caracteres')
      .matches(/^[a-zA-Z0-9_]+$/)
      .withMessage('Usuario solo puede contener letras, números y guiones bajos'),
    body('email')
      .trim()
      .isEmail()
      .withMessage('Email inválido')
      .normalizeEmail(),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Contraseña debe tener al menos 8 caracteres')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/)
      .withMessage('Contraseña debe incluir mayúscula, minúscula y número')
      .escape()
  ],
  (req, res, next) => {
    // Si falla la validación, responder con errores antes de llegar al controlador
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  },
  register
);

// Ruta POST /api/auth/login
router.post(
  '/login',
  [
    body('identifier').trim().notEmpty().withMessage('Usuario o email requerido'),
    body('password').notEmpty().withMessage('Contraseña requerida')
  ],
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  },
  login
);

module.exports = router;
