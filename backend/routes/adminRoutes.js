const express = require('express');
const { authenticate, isAdmin } = require('../middlewares/auth');
const { listUsers } = require('../controllers/adminController');

const router = express.Router();

// Todas las rutas de administración requieren JWT + rol administrador
router.use(authenticate);
router.use(isAdmin);

// GET /api/admin/users - Listar usuarios (solo administradores)
router.get('/users', listUsers);

module.exports = router;