// Configuration de la base de données MySQL (Amazon RDS).
// Remplacez les valeurs entre crochets par celles de votre instance RDS,
// puis lancez : npm run init-db
module.exports = {
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: '',
  database: 'foodexpress_db',
  connectionLimit: 10,
};
