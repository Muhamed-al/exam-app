// Migration : npm run init-db
// Crée automatiquement la base (si elle n'existe pas), les tables, puis charge les données
// initiales depuis db/init.sql, en utilisant config.js. Peut être relancée sans doublon.
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const config = require('../config');

async function main() {
  if (String(config.host).startsWith('[')) {
    throw new Error("config.js n'est pas renseigné (host = endpoint RDS, user, password).");
  }

  console.log(`Connexion à ${config.host}:${config.port} ...`);
  const connection = await mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    connectTimeout: 10000,
    multipleStatements: true,
  });

  try {
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${config.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    console.log(`Base "${config.database}" créée (ou déjà existante).`);
    await connection.query(`USE \`${config.database}\``);

    const sql = fs.readFileSync(path.join(__dirname, '..', 'db', 'init.sql'), 'utf8');
    await connection.query(sql);

    const [[{ d }]] = await connection.query('SELECT COUNT(*) AS d FROM categories');
    const [[{ s }]] = await connection.query('SELECT COUNT(*) AS s FROM plats');
    console.log(`Tables créées et données chargées : ${d} catégories, ${s} plats.`);
  } finally {
    await connection.end();
  }
}

main().catch((err) => {
  console.error("Erreur lors de l'initialisation de la base :", err.message);
  process.exit(1);
});
