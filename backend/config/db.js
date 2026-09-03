require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'overdrive_user',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'overdrive',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  namedPlaceholders: true,
  // Todas las consultas se ejecutan como Prepared Statements
  dateStrings: true,
  // Evitar inyección SQL mediante SQL Mode estricto
  flags: ['-FOUND_ROWS']
});

async function getConnection() {
  return await pool.getConnection();
}

async function executeQuery(sql, params = []) {
  const connection = await pool.getConnection();
  try {
    // Prepared statement nativo: protege contra Inyección SQL
    const [rows] = await connection.execute(sql, params);
    return rows;
  } finally {
    connection.release();
  }
}

module.exports = {
  pool,
  getConnection,
  executeQuery
};
