// Crée la base (si besoin), les tables et insère les données initiales
// à partir de db/init.sql, en utilisant db.config.js.
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const config = require('../db.config');

async function main() {
  const connection = await mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    multipleStatements: true,
  });

  await connection.query(
    `CREATE DATABASE IF NOT EXISTS \`${config.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  );
  await connection.query(`USE \`${config.database}\``);

  const sql = fs.readFileSync(path.join(__dirname, '..', 'db', 'init.sql'), 'utf8');
  await connection.query(sql);
  await connection.end();

  console.log(`Base "${config.database}" initialisée avec succès.`);
}

main().catch((err) => {
  console.error("Erreur lors de l'initialisation de la base :", err.message);
  process.exit(1);
});
