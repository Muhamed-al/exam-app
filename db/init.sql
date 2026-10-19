-- Schéma + données initiales de l'application de prise de rendez-vous.
-- Idempotent : peut être relancé sans erreur ni doublon.

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS specialites (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nom VARCHAR(100) NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS medecins (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nom VARCHAR(100) NOT NULL,
  prenom VARCHAR(100) NOT NULL,
  specialite_id INT NOT NULL,
  CONSTRAINT fk_medecin_specialite FOREIGN KEY (specialite_id) REFERENCES specialites(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS rendez_vous (
  id INT AUTO_INCREMENT PRIMARY KEY,
  medecin_id INT NOT NULL,
  patient_nom VARCHAR(100) NOT NULL,
  patient_prenom VARCHAR(100) NOT NULL,
  patient_email VARCHAR(150) NOT NULL,
  patient_telephone VARCHAR(30),
  date_rdv DATE NOT NULL,
  heure_rdv TIME NOT NULL,
  motif VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_rdv_medecin FOREIGN KEY (medecin_id) REFERENCES medecins(id),
  CONSTRAINT uq_creneau UNIQUE (medecin_id, date_rdv, heure_rdv)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Données initiales
INSERT IGNORE INTO specialites (id, nom) VALUES
  (1, 'Médecine générale'),
  (2, 'Cardiologie'),
  (3, 'Dermatologie'),
  (4, 'Pédiatrie'),
  (5, 'Ophtalmologie'),
  (6, 'Gynécologie');

INSERT IGNORE INTO medecins (id, nom, prenom, specialite_id) VALUES
  (1, 'Ben Ali', 'Sami', 1),
  (2, 'Trabelsi', 'Amel', 1),
  (3, 'Gharbi', 'Karim', 2),
  (4, 'Jaziri', 'Leila', 2),
  (5, 'Mansouri', 'Nadia', 3),
  (6, 'Hammami', 'Youssef', 4),
  (7, 'Chaabane', 'Ines', 4),
  (8, 'Bouazizi', 'Mehdi', 5),
  (9, 'Khelifi', 'Sonia', 6);
