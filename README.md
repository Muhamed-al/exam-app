# Application de prise de rendez-vous (Node.js + MySQL)

## Structure

```
db.config.js        Configuration MySQL (surchargeable par variables d'environnement)
db.js               Pool de connexions MySQL
mail.config.js      Configuration SMTP (email de confirmation)
mailer.js           Envoi de l'email de confirmation (Nodemailer)
server.js           Serveur Express + API REST
db/init.sql         Création des tables + données initiales (spécialités, médecins)
scripts/init-db.js  Exécute db/init.sql sur la base configurée
docker-compose.yml  MySQL 8 qui exécute init.sql automatiquement au premier lancement
public/             Formulaire de prise de rendez-vous (HTML/CSS/JS)
```

## Lancement

1. Installer les dépendances :
   ```bash
   npm install
   ```
2. Démarrer MySQL — au choix :
   - **Docker** (init.sql est exécuté automatiquement au premier démarrage) :
     ```bash
     docker compose up -d
     ```
   - **MySQL existant** : adapter `db.config.js` (ou les variables `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`), puis :
     ```bash
     npm run init-db
     ```
3. Démarrer l'application :
   ```bash
   npm start
   ```
4. Ouvrir http://localhost:3000

## Email de confirmation

À chaque rendez-vous confirmé, un email récapitulatif est envoyé au patient.
Renseigner le serveur SMTP dans `mail.config.js` ; par exemple avec Gmail :

```js
host: 'smtp.gmail.com', port: 465, secure: true,
user: 'votre.adresse@gmail.com', pass: 'mot-de-passe-application',
```

Pour Gmail, `pass` doit être un « mot de passe d'application » (compte Google → Sécurité → Validation en deux étapes → Mots de passe des applications).
Si `host` est vide, l'email n'est pas envoyé mais affiché dans la console du serveur.
Un échec d'envoi n'annule jamais le rendez-vous.

## API

| Méthode | Route | Description |
|---|---|---|
| GET | `/api/specialites` | Liste des spécialités |
| GET | `/api/medecins?specialite_id=ID` | Médecins (filtrés par spécialité) |
| GET | `/api/medecins/:id/creneaux?date=AAAA-MM-JJ` | Créneaux libres (09:00–17:00, 30 min) |
| GET | `/api/rendez-vous` | Liste des rendez-vous |
| POST | `/api/rendez-vous` | Créer un rendez-vous |

Un même créneau ne peut pas être réservé deux fois pour un médecin (contrainte `UNIQUE` en base).
