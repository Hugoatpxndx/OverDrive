const express = require('express');
const { body, validationResult } = require('express-validator');
const { register, login } = require('../controllers/authController');

const router = express.Router();

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
