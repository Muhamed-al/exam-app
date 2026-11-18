const mysql = require('mysql2/promise');
const config = require('./config');

const pool = mysql.createPool({
  host: config.host,
  port: config.port,
  user: config.user,
  password: config.password,
  database: config.database,
  connectionLimit: config.connectionLimit,
  connectTimeout: 5000,
  dateStrings: true,
});

module.exports = pool;
