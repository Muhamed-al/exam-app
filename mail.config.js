// Configuration SMTP pour l'envoi des emails de confirmation.
// Laisser host vide pour désactiver l'envoi réel : l'email est alors affiché dans la console.
// Exemple Gmail : host 'smtp.gmail.com', port 465, secure true,
// user = votre adresse Gmail, pass = un "mot de passe d'application" (pas le mot de passe du compte).
module.exports = {
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  user: 'alouanimuhamed@gmail.com',
  pass: 'gaxn arjw onrl lwvp',
  from: 'MediRDV <no-reply@medirdv.local>',
};
