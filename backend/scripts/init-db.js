/**
 * Inicializa el esquema de la base de datos OverDrive.
 * Útil para entornos nuevos (por ejemplo, el despliegue público):
 *   npm run db:init
 *
 * Es idempotente: usa CREATE TABLE/INSERT ... IF NOT EXISTS y tolera
 * los índices ya creados.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

(async () => {
  const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    multipleStatements: true
  });

  try {
    await connection.query(sql);
    console.log('Esquema de OverDrive inicializado correctamente.');
  } catch (err) {
    // Los índices no soportan IF NOT EXISTS; si ya existen, no es un error.
    if (err.code === 'ER_DUP_KEYNAME') {
      console.log('El esquema ya estaba inicializado (índices existentes).');
    } else {
      throw err;
    }
  } finally {
    await connection.end();
  }
})().catch((err) => {
  console.error('Error al inicializar la base de datos:', err.message);
  process.exit(1);
});
