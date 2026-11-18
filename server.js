const os = require('os');
const path = require('path');
const express = require('express');
const pool = require('./db');
const config = require('./config');

const app = express();
const PORT = process.env.PORT || 3000;
const INSTANCE = os.hostname(); // ex. ip-10-0-1-25.ec2.internal → montre quelle instance répond derrière l'ALB

const FRAIS_LIVRAISON = 3; // DT
const SEUIL_LIVRAISON_OFFERTE = 40; // DT
const MAX_QUANTITE = 20;

const estConfiguree = () => !String(config.host).startsWith('[');

app.use(express.json());
app.use((req, res, next) => {
  res.set('X-Served-By', INSTANCE);
  next();
});
app.use(express.static(path.join(__dirname, 'public')));

// Health check pour le Target Group de l'ALB (ne dépend pas de la base)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', instance: INSTANCE });
});

// Informations sur l'instance, l'état de la connexion à la base et les tarifs de livraison
app.get('/api/info', async (req, res) => {
  let db = 'non configurée';
  if (estConfiguree()) {
    try {
      await pool.query('SELECT 1');
      db = 'connectée';
    } catch (err) {
      db = `erreur (${err.code || err.message})`;
    }
  }
  res.json({
    instance: INSTANCE,
    db,
    db_host: config.host,
    frais_livraison: FRAIS_LIVRAISON,
    seuil_livraison_offerte: SEUIL_LIVRAISON_OFFERTE,
  });
});

// Catégories du menu
app.get('/api/categories', async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT id, nom, icone FROM categories ORDER BY ordre, nom');
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// Plats disponibles (filtrables par catégorie)
app.get('/api/plats', async (req, res, next) => {
  try {
    const { categorie_id } = req.query;
    let sql = `SELECT p.id, p.nom, p.description, p.prix, p.promo, p.categorie_id, c.nom AS categorie, c.icone
               FROM plats p JOIN categories c ON c.id = p.categorie_id
               WHERE p.disponible = TRUE`;
    const params = [];
    if (categorie_id) {
      sql += ' AND p.categorie_id = ?';
      params.push(categorie_id);
    }
    sql += ' ORDER BY c.ordre, p.prix';
    const [rows] = await pool.query(sql, params);
    res.json(rows.map((p) => ({ ...p, prix: Number(p.prix), promo: Boolean(p.promo) })));
  } catch (err) {
    next(err);
  }
});

// Dernières commandes
app.get('/api/commandes', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT c.id, c.client_prenom, c.client_nom, c.mode, c.total, c.statut,
              DATE_FORMAT(c.created_at, '%Y-%m-%d %H:%i') AS created_at,
              GROUP_CONCAT(CONCAT(l.quantite, '× ', p.nom) ORDER BY l.id SEPARATOR ', ') AS articles
       FROM commandes c
       JOIN commande_lignes l ON l.commande_id = c.id
       JOIN plats p ON p.id = l.plat_id
       GROUP BY c.id
       ORDER BY c.id DESC
       LIMIT 12`
    );
    res.json(rows.map((c) => ({ ...c, total: Number(c.total), reference: reference(c.id) })));
  } catch (err) {
    next(err);
  }
});

function reference(id) {
  return `FE-${String(id).padStart(6, '0')}`;
}

// Passer une commande
app.post('/api/commandes', async (req, res, next) => {
  const { client_nom, client_prenom, client_telephone, client_email, mode, adresse, note } = req.body || {};
  const lignes = Array.isArray(req.body?.lignes) ? req.body.lignes : [];

  if (!client_nom || !client_prenom || !client_telephone) {
    return res.status(400).json({ error: 'Veuillez renseigner votre nom, prénom et téléphone.' });
  }
  if (!['livraison', 'emporter'].includes(mode)) {
    return res.status(400).json({ error: 'Mode de commande invalide.' });
  }
  if (mode === 'livraison' && !String(adresse || '').trim()) {
    return res.status(400).json({ error: "L'adresse de livraison est obligatoire." });
  }
  if (!lignes.length) {
    return res.status(400).json({ error: 'Votre panier est vide.' });
  }
  const quantites = new Map();
  for (const l of lignes) {
    const id = Number(l?.plat_id);
    const q = Number(l?.quantite);
    if (!Number.isInteger(id) || !Number.isInteger(q) || q < 1 || q > MAX_QUANTITE) {
      return res.status(400).json({ error: `Quantité invalide (1 à ${MAX_QUANTITE} par plat).` });
    }
    quantites.set(id, (quantites.get(id) || 0) + q);
  }

  let conn;
  try {
    conn = await pool.getConnection();

    // Les prix viennent toujours de la base, jamais du navigateur
    const ids = [...quantites.keys()];
    const [plats] = await conn.query('SELECT id, nom, prix FROM plats WHERE disponible = TRUE AND id IN (?)', [ids]);
    if (plats.length !== ids.length) {
      return res.status(400).json({ error: "Un des plats n'est plus disponible. Actualisez le menu." });
    }

    const sousTotal = plats.reduce((s, p) => s + Number(p.prix) * quantites.get(p.id), 0);
    const frais = mode === 'livraison' && sousTotal < SEUIL_LIVRAISON_OFFERTE ? FRAIS_LIVRAISON : 0;
    const total = sousTotal + frais;

    await conn.beginTransaction();
    const [result] = await conn.query(
      `INSERT INTO commandes
         (client_nom, client_prenom, client_telephone, client_email, mode, adresse, note, sous_total, frais_livraison, total)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        client_nom,
        client_prenom,
        client_telephone,
        client_email || null,
        mode,
        mode === 'livraison' ? adresse : null,
        note || null,
        sousTotal,
        frais,
        total,
      ]
    );
    await conn.query('INSERT INTO commande_lignes (commande_id, plat_id, quantite, prix_unitaire) VALUES ?', [
      plats.map((p) => [result.insertId, p.id, quantites.get(p.id), p.prix]),
    ]);
    await conn.commit();

    res.status(201).json({
      id: result.insertId,
      reference: reference(result.insertId),
      sous_total: sousTotal,
      frais_livraison: frais,
      total,
      delai: mode === 'livraison' ? '35 à 45 min' : '20 min',
      instance: INSTANCE,
      message: 'Commande enregistrée avec succès.',
    });
  } catch (err) {
    if (conn) await conn.rollback().catch(() => {});
    next(err);
  } finally {
    if (conn) conn.release();
  }
});

const MESSAGES_DB = {
  ER_BAD_DB_ERROR: `La base "${config.database}" n'existe pas encore : lancez « npm run init-db » (création de la base et chargement des données).`,
  ER_NO_SUCH_TABLE: 'Les tables n\'existent pas encore : lancez « npm run init-db ».',
  ER_ACCESS_DENIED_ERROR: 'Accès refusé par MySQL : vérifiez user et password dans config.js.',
  ECONNREFUSED: `MySQL ne répond pas sur ${config.host}:${config.port} : vérifiez que le serveur MySQL est démarré (ou le Security Group RDS).`,
  ETIMEDOUT: `Délai dépassé vers ${config.host}:${config.port} : vérifiez l'endpoint et le Security Group RDS (port 3306).`,
  ENOTFOUND: `Hôte MySQL introuvable (${config.host}) : vérifiez host dans config.js.`,
};

app.use((err, req, res, next) => {
  console.error(err.code || '', err.message);
  if (!estConfiguree()) {
    return res.status(503).json({ error: 'Base de données non configurée : renseignez config.js puis redémarrez l\'application.' });
  }
  if (MESSAGES_DB[err.code]) {
    return res.status(503).json({ error: MESSAGES_DB[err.code] });
  }
  res.status(500).json({ error: 'Erreur serveur.' });
});

app.listen(PORT, () => {
  console.log(`FoodExpress démarré sur http://localhost:${PORT} (instance ${INSTANCE})`);
});
