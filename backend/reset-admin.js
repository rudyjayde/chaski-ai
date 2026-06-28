// Script one-shot: crea o actualiza el usuario admin.tipcar con contraseña admin123
// Uso: node reset-admin.js
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME     || 'chaski ai2',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD || '',
});

async function main() {
  try {
    const hash = await bcrypt.hash('admin123', 10);
    console.log('Hash generado:', hash);

    // Insertar asociación si no existe
    await pool.query(`
      INSERT INTO associations (id, name, code)
      VALUES ('11111111-1111-1111-1111-111111111111', 'Asociación TipCar', 'TIPCAR')
      ON CONFLICT DO NOTHING
    `);

    // Upsert del usuario admin
    const result = await pool.query(`
      INSERT INTO users (id, username, password_hash, role, association_id, active)
      VALUES (
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        'admin.tipcar',
        $1,
        'admin',
        '11111111-1111-1111-1111-111111111111',
        true
      )
      ON CONFLICT (username) DO UPDATE
        SET password_hash = $1,
            active        = true
      RETURNING id, username, role, active
    `, [hash]);

    console.log('Usuario admin listo:', result.rows[0]);
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

main();
