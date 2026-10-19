const mysql = require('mysql2/promise');
const config = require('./db.config');

const pool = mysql.createPool({
  host: config.host,
  port: config.port,
  user: config.user,
  password: config.password,
  database: config.database,
  connectionLimit: config.connectionLimit,
  dateStrings: true,
});

module.exports = pool;
