require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || process.env.MARIADB_HOST || 'localhost',
  port: process.env.DB_PORT || process.env.MARIADB_PORT || 3306,
  user: process.env.MARIADB_USER || process.env.DB_USER || 'overdrive_user',
  password: process.env.MARIADB_PASSWORD || process.env.DB_PASSWORD || '',
  database: process.env.MARIADB_DATABASE || process.env.DB_NAME || 'overdrive',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  namedPlaceholders: true,
  dateStrings: true,
  connectTimeout: 10000,
  // Mantener vivas las conexiones (evita que MariaDB las cierre por idle
  // y que el pool entregue conexiones muertas que cuelguen las consultas)
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  idleTimeout: 30000,
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
