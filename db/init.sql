-- FoodExpress : schéma + données initiales.
-- Idempotent : peut être relancé sans erreur ni doublon (npm run init-db).

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nom VARCHAR(100) NOT NULL UNIQUE,
  icone VARCHAR(10) NOT NULL,
  ordre INT NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS plats (
  id INT AUTO_INCREMENT PRIMARY KEY,
  categorie_id INT NOT NULL,
  nom VARCHAR(150) NOT NULL,
  description VARCHAR(255),
  prix DECIMAL(8,2) NOT NULL,
  promo BOOLEAN NOT NULL DEFAULT FALSE,
  disponible BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT fk_plat_categorie FOREIGN KEY (categorie_id) REFERENCES categories(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS commandes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  client_nom VARCHAR(100) NOT NULL,
  client_prenom VARCHAR(100) NOT NULL,
  client_telephone VARCHAR(30) NOT NULL,
  client_email VARCHAR(150),
  mode ENUM('livraison', 'emporter') NOT NULL,
  adresse VARCHAR(255),
  note VARCHAR(255),
  sous_total DECIMAL(10,2) NOT NULL,
  frais_livraison DECIMAL(10,2) NOT NULL DEFAULT 0,
  total DECIMAL(10,2) NOT NULL,
  statut VARCHAR(30) NOT NULL DEFAULT 'En préparation',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS commande_lignes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  commande_id INT NOT NULL,
  plat_id INT NOT NULL,
  quantite INT NOT NULL,
  prix_unitaire DECIMAL(8,2) NOT NULL,
  CONSTRAINT fk_ligne_commande FOREIGN KEY (commande_id) REFERENCES commandes(id) ON DELETE CASCADE,
  CONSTRAINT fk_ligne_plat FOREIGN KEY (plat_id) REFERENCES plats(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Données initiales
INSERT IGNORE INTO categories (id, nom, icone, ordre) VALUES
  (1, 'Pizzas', '🍕', 1),
  (2, 'Burgers', '🍔', 2),
  (3, 'Tacos & Wraps', '🌯', 3),
  (4, 'Plats tunisiens', '🍲', 4),
  (5, 'Salades', '🥗', 5),
  (6, 'Desserts', '🍰', 6),
  (7, 'Boissons', '🥤', 7);

INSERT IGNORE INTO plats (id, categorie_id, nom, description, prix, promo) VALUES
  (1,  1, 'Pizza Margherita',      'Sauce tomate, mozzarella, basilic frais',             14.50, FALSE),
  (2,  1, 'Pizza Neptune',         'Thon, olives, oignons, mozzarella',                   17.00, FALSE),
  (3,  1, 'Pizza 4 Fromages',      'Mozzarella, emmental, gorgonzola, parmesan',          19.50, TRUE),
  (4,  2, 'Classic Burger',        'Bœuf 150 g, cheddar, salade, tomate, frites',         16.00, FALSE),
  (5,  2, 'Chicken Burger',        'Poulet croustillant, sauce maison, frites',           15.00, TRUE),
  (6,  2, 'Double Cheese',         'Double bœuf, double cheddar, oignons caramélisés',    22.00, FALSE),
  (7,  3, 'Tacos Poulet',          'Poulet mariné, frites, sauce fromagère',              13.00, FALSE),
  (8,  3, 'Wrap Escalope',         'Escalope grillée, crudités, sauce blanche',           12.00, FALSE),
  (9,  4, 'Couscous Agneau',       'Semoule, légumes de saison, agneau',                  24.00, FALSE),
  (10, 4, 'Lablabi',               'Pois chiches, pain, œuf, harissa, cumin',              8.00, TRUE),
  (11, 4, 'Ojja Merguez',          'Sauce tomate épicée, merguez, œufs',                  14.00, FALSE),
  (12, 5, 'Salade César',          'Poulet, laitue, croûtons, parmesan, sauce César',     13.50, FALSE),
  (13, 5, 'Salade Méchouia',       'Poivrons et tomates grillés, thon, œuf',              10.00, FALSE),
  (14, 6, 'Tiramisu',              'Mascarpone, café, cacao',                              9.00, FALSE),
  (15, 6, 'Fondant au chocolat',   'Cœur coulant, servi tiède',                            8.50, TRUE),
  (16, 7, 'Citronnade maison',     'Citron frais et menthe, 33 cl',                        4.50, FALSE),
  (17, 7, 'Soda 33 cl',            'Coca-Cola, Fanta ou Sprite',                           3.00, FALSE),
  (18, 7, 'Eau minérale 50 cl',    'Plate ou gazeuse',                                     1.50, FALSE);
