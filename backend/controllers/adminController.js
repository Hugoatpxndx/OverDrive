const { executeQuery } = require('../config/db');

// Listar usuarios (solo administradores)
// Nunca expone el password_hash por seguridad
const listUsers = async (req, res) => {
  try {
    const rows = await executeQuery(
      'SELECT id, username, email, role, tokens, created_at FROM users ORDER BY id'
    );

    return res.json({ users: rows });
  } catch (error) {
    console.error('Error al listar usuarios:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { listUsers };