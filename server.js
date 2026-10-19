const path = require('path');
const express = require('express');
const pool = require('./db');
const { envoyerConfirmation, smtpActif } = require('./mailer');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Créneaux de consultation : 09:00 → 17:00, toutes les 30 minutes
function genererCreneaux() {
  const creneaux = [];
  for (let h = 9; h < 17; h++) {
    for (const m of [0, 30]) {
      creneaux.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }
  return creneaux;
}

// Liste des spécialités
app.get('/api/specialites', async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT id, nom FROM specialites ORDER BY nom');
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// Liste des médecins (filtrable par spécialité)
app.get('/api/medecins', async (req, res, next) => {
  try {
    const { specialite_id } = req.query;
    let sql = `SELECT m.id, m.nom, m.prenom, m.specialite_id, s.nom AS specialite
               FROM medecins m JOIN specialites s ON s.id = m.specialite_id`;
    const params = [];
    if (specialite_id) {
      sql += ' WHERE m.specialite_id = ?';
      params.push(specialite_id);
    }
    sql += ' ORDER BY m.nom, m.prenom';
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// Créneaux disponibles d'un médecin pour une date
app.get('/api/medecins/:id/creneaux', async (req, res, next) => {
  try {
    const { date } = req.query;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) {
      return res.status(400).json({ error: 'Paramètre date invalide (format AAAA-MM-JJ).' });
    }
    const [rows] = await pool.query(
      "SELECT TIME_FORMAT(heure_rdv, '%H:%i') AS heure FROM rendez_vous WHERE medecin_id = ? AND date_rdv = ?",
      [req.params.id, date]
    );
    const pris = new Set(rows.map((r) => r.heure));
    res.json(genererCreneaux().filter((c) => !pris.has(c)));
  } catch (err) {
    next(err);
  }
});

// Liste des rendez-vous
app.get('/api/rendez-vous', async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT r.id, r.patient_nom, r.patient_prenom, r.patient_email, r.patient_telephone,
              r.date_rdv, TIME_FORMAT(r.heure_rdv, '%H:%i') AS heure_rdv, r.motif,
              m.nom AS medecin_nom, m.prenom AS medecin_prenom, s.nom AS specialite
       FROM rendez_vous r
       JOIN medecins m ON m.id = r.medecin_id
       JOIN specialites s ON s.id = m.specialite_id
       ORDER BY r.date_rdv, r.heure_rdv`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// Prise de rendez-vous
app.post('/api/rendez-vous', async (req, res, next) => {
  const { medecin_id, patient_nom, patient_prenom, patient_email, patient_telephone, date_rdv, heure_rdv, motif } =
    req.body || {};

  if (!medecin_id || !patient_nom || !patient_prenom || !patient_email || !date_rdv || !heure_rdv) {
    return res.status(400).json({ error: 'Veuillez remplir tous les champs obligatoires.' });
  }
  if (!genererCreneaux().includes(heure_rdv)) {
    return res.status(400).json({ error: 'Créneau horaire invalide.' });
  }
  const today = new Date().toISOString().slice(0, 10);
  if (date_rdv < today) {
    return res.status(400).json({ error: 'La date du rendez-vous ne peut pas être dans le passé.' });
  }

  try {
    const [result] = await pool.query(
      `INSERT INTO rendez_vous
         (medecin_id, patient_nom, patient_prenom, patient_email, patient_telephone, date_rdv, heure_rdv, motif)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [medecin_id, patient_nom, patient_prenom, patient_email, patient_telephone || null, date_rdv, heure_rdv, motif || null]
    );

    // Email de confirmation : un échec d'envoi n'annule pas le rendez-vous
    // statut : 'envoye' | 'console' (SMTP non configuré) | 'echec'
    let email_statut = 'echec';
    try {
      const [[medecin]] = await pool.query(
        `SELECT m.nom, m.prenom, s.nom AS specialite
         FROM medecins m JOIN specialites s ON s.id = m.specialite_id WHERE m.id = ?`,
        [medecin_id]
      );
      await envoyerConfirmation({
        patient_prenom,
        patient_nom,
        patient_email,
        date_rdv,
        heure_rdv,
        motif,
        medecin_prenom: medecin.prenom,
        medecin_nom: medecin.nom,
        specialite: medecin.specialite,
      });
      email_statut = smtpActif ? 'envoye' : 'console';
    } catch (mailErr) {
      console.error("Échec de l'envoi de l'email de confirmation :", mailErr.message);
    }

    res.status(201).json({ id: result.insertId, email_statut, message: 'Rendez-vous enregistré avec succès.' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Ce créneau est déjà réservé pour ce médecin.' });
    }
    if (err.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(400).json({ error: 'Médecin inconnu.' });
    }
    next(err);
  }
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Erreur serveur.' });
});

app.listen(PORT, () => {
  console.log(`Serveur démarré sur http://localhost:${PORT}`);
});
