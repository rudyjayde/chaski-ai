require('dotenv').config();

const express = require('express');
const cors    = require('cors');
const path    = require('path');
const fs      = require('fs');
const pool    = require('./config/db');
const { startGPSServer } = require('./gps-server');

const app  = express();
const PORT = process.env.PORT || 3005;

// ── Middlewares ──────────────────────────────────────────────
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.options('*', cors());
app.use(express.json());

// ── Archivos estáticos ───────────────────────────────────────
const ROOT = path.join(__dirname, '..');
app.use(express.static(ROOT));

// ── URLs limpias (sin extensión .html) ──────────────────────
// /admin/manifests → admin/manifests/index.html
// /login           → login.html
app.use((req, res, next) => {
  if (req.path.startsWith('/api') || path.extname(req.path)) return next();
  const direct = path.join(ROOT, req.path + '.html');
  if (fs.existsSync(direct)) return res.sendFile(direct);
  const index = path.join(ROOT, req.path, 'index.html');
  if (fs.existsSync(index)) return res.sendFile(index);
  next();
});

// ── Rutas de navegación canónicas ───────────────────────────
app.get(['/admin', '/admin/'], (req, res) => res.redirect('/admin/dashboard'));
app.get('/admin/dashboard',    (req, res) => res.sendFile(path.join(ROOT, 'admin/index.html')));

// ── API: rutas específicas de este servidor ──────────────────
app.use('/api/gps',            require('./routes/gps'));
app.use('/api/gps-devices',    require('./routes/gps-devices'));
app.use('/api/communications', require('./routes/communications'));

// ── Health check ─────────────────────────────────────────────
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

// ── Inicio ───────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 CHASKI AI Backend corriendo en http://localhost:${PORT}`);
  console.log(`   Entorno : ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Base BD : ${process.env.DB_NAME} en ${process.env.DB_HOST}:${process.env.DB_PORT}`);
  console.log(`   Anthropic: ${process.env.ANTHROPIC_API_KEY ? '✓ Configurada' : '✗ Falta ANTHROPIC_API_KEY'}`);
  startGPSServer();
  console.log('');
});
