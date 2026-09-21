require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/authRoutes');
const submissionRoutes = require('./routes/submissionRoutes');
const adminRoutes = require('./routes/adminRoutes');
const playlistRoutes = require('./routes/playlistRoutes');
const spotifyRoutes = require('./routes/spotifyRoutes');

const app = express();

// ============================================================
// SEGURIDAD (OWASP)
// ============================================================

// Cabeceras de seguridad HTTP (helmet):
//  - X-Content-Type-Options
//  - X-Frame-Options
//  - Strict-Transport-Security
//  - Content-Security-Policy
app.use(helmet());

// Evita el almacenamiento en caché de respuestas de la API (datos sensibles).
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

// Control de CORS: solo orígenes permitidos
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',');
app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Limitación de peticiones (Rate Limiting) - Mitiga fuerza bruta
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas peticiones. Intente más tarde.' }
});
app.use('/api/auth', limiter);

// Limitador ESTRICTO para login/registro (fuerza bruta sobre credenciales):
// máx 10 intentos por IP cada 15 min. Refuerza al global de /api/auth.
// Se omite en la suite de tests (evita bloquear pruebas legítimas).
if (process.env.NODE_ENV !== 'test') {
  const authStrictLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Demasiados intentos de acceso. Espera 15 minutos.' }
  });
  app.use('/api/auth/login', authStrictLimiter);
  app.use('/api/auth/register', authStrictLimiter);
}

// Body parser con límite de tamaño (previene DoS por payloads pesados)
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// ============================================================
// RUTAS
// ============================================================
app.use('/api/auth', authRoutes);
app.use('/api/submissions', submissionRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/playlists', playlistRoutes);
app.use('/api/spotify', spotifyRoutes);

// Ruta de salud del servidor
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Manejo centralizado de errores (evita exponer stack traces)
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: 'Error interno del servidor',
    message: process.env.NODE_ENV === 'production' ? undefined : err.message
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Recurso no encontrado' });
});

const PORT = process.env.PORT || 4000;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Servidor OverDrive corriendo en http://localhost:${PORT}`);
  });
}

module.exports = app;
