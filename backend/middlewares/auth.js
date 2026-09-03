const jwt = require('jsonwebtoken');

// Middleware para verificar el JWT en el Authorization header
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;

  // El token debe venir en formato Bearer <token>
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Acceso no autorizado: falta token' });
  }

  const token = authHeader.split(' ')[1];

  try {
    // Verifica la firma y validez del token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secreto_dev');
    req.user = {
      id: decoded.id,
      username: decoded.username,
      role: decoded.role
    };
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
};

// Middleware para verificar rol de administrador
const isAdmin = (req, res, next) => {
  // Requiere que authenticate haya corrido antes
  if (!req.user) {
    return res.status(401).json({ error: 'Acceso no autorizado' });
  }
  if (req.user.role !== 'administrador') {
    return res.status(403).json({ error: 'Acceso denegado: se requiere rol de administrador' });
  }
  return next();
};

// Middleware para verificar rol de artista (modo artista)
const isArtist = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Acceso no autorizado' });
  }
  return next();
};

module.exports = { authenticate, isAdmin, isArtist };
