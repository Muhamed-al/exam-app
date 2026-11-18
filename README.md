# FoodExpress — Commande de repas en ligne (Node.js + MySQL)

Application de l'examen TP AWS **FoodExpress** : menu par catégories, panier, livraison ou à emporter, et commandes stockées dans **MySQL (Amazon RDS)**.

## Démarrage

```bash
npm install
npm start          # écoute sur le port 3000 (variable PORT pour changer)
```

## Base de données

Renseigner `config.js` :

```js
host: '[DATABASE-ENDPOINT]',   // endpoint RDS
port: 3306,
user: '[USERNAME]',
password: '[PASSWORD]',
```

Puis lancer la migration, qui **crée automatiquement la base** `foodexpress_db` (si elle n'existe pas), les tables, et **charge les données** (catégories et plats du menu) :

```bash
npm run init-db
```

La commande peut être relancée sans erreur ni doublon. Redémarrez ensuite l'application (`npm start`).

## Points utiles pour le déploiement AWS

| Élément | Valeur |
|---|---|
| Port de l'application | **3000** (Target Group HTTP:3000, SG des instances : TCP 3000 depuis le SG de l'ALB) |
| Health check du Target Group | `GET /health` → 200 (ne dépend pas de la base) |
| Instance qui a répondu | pied de page de l'appli, `GET /api/info` ou en-tête `X-Served-By` |
| Port MySQL | 3306 (SG RDS : TCP 3306 depuis le SG des instances) |

Le pied de page affiche aussi l'état de la base (`non configurée`, `connectée` ou l'erreur), ce qui permet de vérifier rapidement `config.js` et le Security Group RDS.

## API

| Méthode | Route | Rôle |
|---|---|---|
| GET | `/api/categories` | Catégories du menu |
| GET | `/api/plats?categorie_id=` | Plats disponibles |
| GET | `/api/commandes` | 12 dernières commandes |
| POST | `/api/commandes` | Commander (`client_*`, `mode` = `livraison`/`emporter`, `adresse`, `note`, `lignes: [{plat_id, quantite}]`) |
| GET | `/api/info` | Instance, état de la base, tarifs de livraison |
| GET | `/health` | Health check de l'ALB |

Les prix sont toujours recalculés côté serveur. Livraison : 3 DT, offerte dès 40 DT de commande.
