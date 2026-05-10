// ============================================================
// CHASKI AI 2.0 — Servidor Express principal
// ============================================================
require('dotenv').config();

const express = require('express');
const cors    = require('cors');
const path    = require('path');
const pool    = require('./config/db');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middlewares ──────────────────────────────────────────────
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.options('*', cors());
app.use(express.json());

// ── Frontend estático ────────────────────────────────────────
const frontendPath = path.join(__dirname, '..');
app.use(express.static(frontendPath));
app.get('/admin', (req, res) => res.redirect('/admin/index.html'));

// ── Rutas ────────────────────────────────────────────────────
app.use('/api/assistant', require('./routes/assistant'));

// ── Health check ─────────────────────────────────────────────
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected', timestamp: new Date() });
  } catch (err) {
    res.status(503).json({ status: 'error', db: 'disconnected', error: err.message });
  }
});

// ── Inicio ───────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 CHASKI AI Backend corriendo en http://localhost:${PORT}`);
  console.log(`   Entorno : ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Base BD : ${process.env.DB_NAME} en ${process.env.DB_HOST}:${process.env.DB_PORT}`);
  console.log(`   Anthropic: ${process.env.ANTHROPIC_API_KEY ? '✓ Configurada' : '✗ Falta ANTHROPIC_API_KEY'}\n`);
});
