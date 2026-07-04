require('dotenv').config();

const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const path    = require('path');
const fs      = require('fs');
const pool    = require('./config/db');
const { startGPSServer }            = require('./gps-server');
const { startScheduler }            = require('./services/aiEngine');
const { auth }                      = require('./middleware/auth');
const { sanitizeBody, sanitizeQuery } = require('./middleware/sanitize');
const { apiLimiter }                = require('./middleware/rateLimiter');
const errorHandler                  = require('./middleware/errorHandler');

const app  = express();
const PORT = process.env.PORT || 3005;

// ── Trust proxy (Render / Heroku / nginx) ────────────────────
app.set('trust proxy', 1);

// ── Helmet — cabeceras HTTP de seguridad ─────────────────────
app.use(helmet({
  contentSecurityPolicy: false, // desactivado para no romper el panel SPA
  crossOriginEmbedderPolicy: false,
}));

// ── CORS ─────────────────────────────────────────────────────
const _defaultOrigins = ['http://localhost:3005', 'http://localhost:5500'];
const allowedOrigins  = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()).filter(Boolean)
  : _defaultOrigins;

if (!process.env.ALLOWED_ORIGINS) {
  console.warn('[cors] WARNING: ALLOWED_ORIGINS no configurado — usando solo localhost. Configura en producción.');
}

app.use(cors({
  origin: (origin, cb) => {
    // Sin origin = petición desde el mismo servidor (archivos estáticos, curl, Postman)
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`Origin no permitido por CORS: ${origin}`));
  },
  methods:        ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
  credentials:    true,
}));
app.options('*', cors());

// ── Body parsing + sanitización global ───────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(sanitizeBody);
app.use(sanitizeQuery);

// ── Rate limit global en /api ─────────────────────────────────
app.use('/api', apiLimiter);

// ── Guard de autenticación global para /api ───────────────────
const PUBLIC_API_PATHS = [
  '/api/auth/login',
  '/api/auth/refresh',
  '/api/auth/logout',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/health',
];
app.use('/api', (req, res, next) => {
  if (req.method === 'OPTIONS') return next();
  const fullPath = '/api' + req.path;
  if (PUBLIC_API_PATHS.includes(fullPath)) return next();
  return auth(req, res, next);
});

// ── Archivos estáticos ────────────────────────────────────────
const ROOT = path.join(__dirname, '..');
app.use(express.static(ROOT));

// ── URLs limpias (sin extensión .html) ───────────────────────
app.use((req, res, next) => {
  if (req.path.startsWith('/api') || path.extname(req.path)) return next();
  const direct = path.join(ROOT, req.path + '.html');
  if (fs.existsSync(direct)) return res.sendFile(direct);
  const index = path.join(ROOT, req.path, 'index.html');
  if (fs.existsSync(index)) return res.sendFile(index);
  next();
});

// ── Rutas de navegación canónicas ────────────────────────────
app.get(['/admin', '/admin/'],  (req, res) => res.redirect('/admin/dashboard'));
app.get('/admin/dashboard',     (req, res) => res.sendFile(path.join(ROOT, 'admin/index.html')));
app.get('/admin/ai-dashboard',  (req, res) => res.sendFile(path.join(ROOT, 'admin/ai-dashboard.html')));

// ── API: rutas específicas ────────────────────────────────────
app.use('/api/gps',         require('./routes/gps'));
app.use('/api/gps-devices', require('./routes/gps-devices'));
// /api/communications se registra junto al resto en routes/index.js

// ── Health check ──────────────────────────────────────────────
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected', timestamp: new Date() });
  } catch (err) {
    res.status(503).json({ status: 'error', db: 'disconnected', error: err.message });
  }
});

// ── API: auth, drivers, vehicles, queue, manifests, trips, reports, assistant
require('./routes/index')(app);

// ── Middleware global de errores (debe ir al final) ───────────
app.use(errorHandler);

// ── Inicio ────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n CHASKI AI Backend corriendo en http://localhost:${PORT}`);
  console.log(`   Entorno : ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Base BD : ${process.env.DB_NAME} en ${process.env.DB_HOST}:${process.env.DB_PORT}`);
  console.log(`   Anthropic: ${process.env.ANTHROPIC_API_KEY ? 'Configurada' : 'Falta ANTHROPIC_API_KEY'}`);
  console.log(`   CORS     : ${allowedOrigins.join(', ')}`);
  startGPSServer();
  startScheduler();
  console.log('');
});
