// ============================================================
// CHASKI AI 2.0 — Pool de conexión PostgreSQL
// ============================================================
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'chaski ai2',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',

  // SSL requerido para Neon
  ssl:
    process.env.NODE_ENV === 'production'
      ? { rejectUnauthorized: false }
      : false,
});

pool.on('error', (err) => {
  console.error('Error inesperado en cliente PostgreSQL:', err.message);
});

module.exports = pool;