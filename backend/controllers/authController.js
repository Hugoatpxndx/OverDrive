const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { executeQuery } = require('../config/db');

// Sanitización de cadenas para prevenir XSS en campos de texto
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

// Registro de nuevo usuario
const register = async (req, res) => {
  try {
    const username = sanitizeString(req.body.username);
    const email = req.body.email ? req.body.email.trim().toLowerCase() : '';
    const password = req.body.password || '';

    // Validaciones básicas (manejo adicional respecto a express-validator)
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Todos los campos son obligatorios' });
    }

    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
    if (!usernameRegex.test(username)) {
      return res.status(400).json({ error: 'Usuario inválido: 3-20 caracteres alfanuméricos o guión bajo' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Email inválido' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Contraseña debe tener al menos 8 caracteres' });
    }

    // Verificar si el usuario o email ya existe (query preparada anti-SQLi)
    const existing = await executeQuery(
      'SELECT id FROM users WHERE username = ? OR email = ?',
      [username, email]
    );
    if (existing.length > 0) {
      return res.status(409).json({ error: 'El usuario o email ya está registrado' });
    }

    // Hash de la contraseña con bcrypt (12 rondas por seguridad)
    const passwordHash = await bcrypt.hash(password, 12);

    // Bono inicial de 3 tokens
    const result = await executeQuery(
      'INSERT INTO users (username, email, password_hash, role, tokens) VALUES (?, ?, ?, ?, ?)',
      [username, email, passwordHash, 'usuario', 3]
    );

    const userId = result.insertId;

    // Generar JWT con roles
    const token = jwt.sign(
      { id: userId, username, role: 'usuario' },
      process.env.JWT_SECRET || 'secreto_dev',
      { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
    );

    return res.status(201).json({
      message: 'Usuario registrado exitosamente',
      token,
      user: {
        id: userId,
        username,
        email,
        role: 'usuario',
        tokens: 3
      }
    });
  } catch (error) {
    console.error('Error en registro:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// Login de usuario existente
const login = async (req, res) => {
  try {
    const identifier = req.body.identifier ? req.body.identifier.trim() : '';
    const password = req.body.password || '';

    if (!identifier || !password) {
      return res.status(400).json({ error: 'Usuario/email y contraseña son obligatorios' });
    }

    // Query preparada: parámetros separados, imposible inyección SQL
    const users = await executeQuery(
      'SELECT id, username, email, password_hash, role, tokens FROM users WHERE email = ? OR username = ?',
      [identifier, identifier]
    );

    if (users.length === 0) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const user = users[0];

    // Comparar contraseña encriptada con la ingresada
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // Generar token JWT con roles
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET || 'secreto_dev',
      { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
    );

    return res.status(200).json({
      message: 'Inicio de sesión exitoso',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        tokens: user.tokens
      }
    });
  } catch (error) {
    console.error('Error en login:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { register, login };
