/**
 * db-init.js - Inicialización idempotente de la Base de Datos (Render/Host)
 *
 * Se ejecuta en el arranque del backend (antes de server.js). Aplica:
 *   1. schema.sql completo (CREATE TABLE IF NOT EXISTS / CREATE DATABASE).
 *   2. Migraciones de forma CONDICIONAL (solo si falta la columna clave).
 *   3. Usuario admin por defecto (INSERT IGNORE).
 *
 * Es seguro ejecutarlo repetidas veces.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const DB_NAME = process.env.MARIADB_DATABASE || process.env.DB_NAME || 'overdrive';
const ADMIN_HASH = '$2a$12$xawFLNM.Dd6VOolicX/dCuO0A1Fz/3bCRQIit/87/foPZgU1pbxwi';

// Migraciones: columna que debe existir para considerar que ya se aplicó
const MIGRATIONS = [
  {
    file: '001_spotify_tokens.sql',
    table: 'users',
    column: 'spotify_access_token'
  },
  {
    file: '002_spotify_identity.sql',
    table: 'users',
    column: 'spotify_user_id'
  },
  {
    file: '003_spotify_sync.sql',
    table: 'submissions',
    column: 'spotify_synced'
  },
  {
    file: '004_email_verification.sql',
    table: 'users',
    column: 'email_verified'
  },
  {
    file: '005_comment_resend_cancel.sql',
    table: 'submissions',
    column: 'comment'
  }
];

// Divide un archivo SQL en sentencias individuales (por ;
async function columnExists(conn, table, column) {
  const [rows] = await conn.query(
    'SELECT 1 FROM information_schema.columns WHERE table_schema = ? AND table_name = ? AND column_name = ?',
    [DB_NAME, table, column]
  );
  return rows.length > 0;
}

async function main() {
  // Conexión sin BD (para crear la BD si no existe)
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || process.env.MARIADB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || process.env.MARIADB_PORT || '3306', 10),
    user: process.env.MARIADB_USER || process.env.DB_USER || 'overdrive_user',
    password: process.env.MARIADB_PASSWORD || process.env.DB_PASSWORD || '2010',
    multipleStatements: true,
    namedPlaceholders: false
  });

  const baseDir = path.join(__dirname, '..', 'database');

  // 1. Schema completo
  const schemaSql = fs.readFileSync(path.join(baseDir, 'schema.sql'), 'utf8');
  await conn.query(schemaSql);

  // 2. Migraciones condicionales
  for (const mig of MIGRATIONS) {
    const exists = await columnExists(conn, mig.table, mig.column);
    if (exists) {
      console.log(`[db-init] Migración ${mig.file}: ya aplicada (${mig.table}.${mig.column})`);
      continue;
    }
    const sql = fs.readFileSync(path.join(baseDir, 'migrations', mig.file), 'utf8');
    await conn.query(sql);
    console.log(`[db-init] Migración ${mig.file}: aplicada`);
  }

  // 3. Admin por defecto (idempotente)
  await conn.query(
    `INSERT INTO users (username, email, password_hash, role, tokens, email_verified)
     SELECT 'admin', 'admin@overdrive.app', ?, 'administrador', 10, 1
     FROM DUAL
     WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin@overdrive.app')`,
    [ADMIN_HASH]
  );

  await conn.end();
  console.log(`[db-init] BD ${DB_NAME} lista.`);
}

main().catch((err) => {
  console.error('[db-init] Error inicializando la BD:', err.message);
  process.exit(1);
});