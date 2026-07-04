// ============================================================
// CHASKI AI 2.0 — Pool de conexión PostgreSQL
// ============================================================
const { Pool } = require('pg');

// SSL necesario en producción, cuando el host es Neon, o cuando DB_SSL=true
const useSSL =
  process.env.NODE_ENV === 'production' ||
  process.env.DB_SSL === 'true' ||
  (process.env.DB_HOST || '').includes('neon.tech');

// Render recomienda DATABASE_URL; si está presente, úsalo directamente
const poolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    }
  : {
      host:     process.env.DB_HOST     || 'localhost',
      port:     parseInt(process.env.DB_PORT  || '5432'),
      database: process.env.DB_NAME     || 'chaski ai2',
      user:     process.env.DB_USER     || 'postgres',
      password: process.env.DB_PASSWORD || '',
      ssl:      useSSL ? { rejectUnauthorized: false } : false,
    };

const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  console.error('Error inesperado en cliente PostgreSQL:', err.message);
});

module.exports = pool;