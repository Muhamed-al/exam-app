// Configuration de la base de données MySQL.
// Chaque valeur peut être surchargée par une variable d'environnement
// (utile en production, ex. AWS RDS).
module.exports = {
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: '',
  database: 'rdv_db',
  connectionLimit: 10,
};
