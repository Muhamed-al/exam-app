const $ = (id) => document.getElementById(id);

const state = {
  categories: [],
  plats: [],
  categorie: null, // null = toutes
  panier: new Map(), // plat_id -> quantité
  mode: 'livraison',
  frais: 3,
  seuil: 40,
};

const CLE_PANIER = 'foodexpress-panier';

const dt = (n) => `${Number(n).toFixed(2).replace('.', ',')} DT`;

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === 'text') node.textContent = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  });
  children.forEach((c) => c && node.append(c));
  return node;
}

let toastTimer;
function toast(text, type = 'error') {
  const t = $('toast');
  t.textContent = text;
  t.className = `toast show ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3500);
}

async function api(url, options) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Erreur inattendue');
  return data;
}

/* ---------- Panier (mémorisé dans le navigateur) ---------- */
function sauverPanier() {
  try {
    localStorage.setItem(CLE_PANIER, JSON.stringify({ lignes: [...state.panier], mode: state.mode }));
  } catch {}
}

function restaurerPanier() {
  try {
    const data = JSON.parse(localStorage.getItem(CLE_PANIER) || 'null');
    if (data) {
      state.panier = new Map(data.lignes);
      state.mode = data.mode === 'emporter' ? 'emporter' : 'livraison';
    }
  } catch {}
}

function platParId(id) {
  return state.plats.find((p) => p.id === id);
}

function changerQuantite(id, delta) {
  const q = (state.panier.get(id) || 0) + delta;
  if (q <= 0) state.panier.delete(id);
  else state.panier.set(id, Math.min(q, 20));
  sauverPanier();
  rendrePlats();
  rendrePanier();
  if (delta > 0) {
    const badge = $('mobile-count');
    badge.classList.remove('bump');
    void badge.offsetWidth;
    badge.classList.add('bump');
  }
}

function calculTotaux() {
  let sousTotal = 0;
  let articles = 0;
  state.panier.forEach((q, id) => {
    const p = platParId(id);
    if (p) {
      sousTotal += p.prix * q;
      articles += q;
    }
  });
  const frais = state.mode === 'livraison' && sousTotal > 0 && sousTotal < state.seuil ? state.frais : 0;
  return { sousTotal, frais, total: sousTotal + frais, articles };
}

function stepper(id, q) {
  return el('div', { class: 'stepper' }, [
    el('button', { type: 'button', 'aria-label': 'Retirer un', text: '−', onclick: () => changerQuantite(id, -1) }),
    el('span', { text: String(q) }),
    el('button', { type: 'button', 'aria-label': 'Ajouter un', text: '+', onclick: () => changerQuantite(id, 1) }),
  ]);
}

/* ---------- Menu ---------- */
function rendreCategories() {
  const box = $('categories');
  box.innerHTML = '';
  const tous = [{ id: null, nom: 'Tout', icone: '🍽️' }, ...state.categories];
  tous.forEach((c) => {
    box.append(
      el('button', {
        type: 'button',
        class: 'cat',
        role: 'tab',
        'aria-selected': String(state.categorie === c.id),
        text: `${c.icone} ${c.nom}`,
        onclick: () => {
          state.categorie = c.id;
          rendreCategories();
          rendrePlats();
        },
      })
    );
  });
}

function rendrePlats() {
  const box = $('plats');
  box.innerHTML = '';
  const liste = state.plats.filter((p) => state.categorie === null || p.categorie_id === state.categorie);
  if (!liste.length) {
    box.append(el('div', { class: 'empty-state', text: 'Aucun plat dans cette catégorie pour le moment.' }));
    return;
  }
  liste.forEach((p, i) => {
    const q = state.panier.get(p.id) || 0;
    const action = q
      ? stepper(p.id, q)
      : el('button', { type: 'button', class: 'add-btn', text: '+ Ajouter', onclick: () => changerQuantite(p.id, 1) });
    box.append(
      el('article', { class: 'dish', style: `animation-delay:${Math.min(i, 12) * 30}ms` }, [
        el('div', { class: 'dish-visual' }, [
          el('span', { text: p.icone }),
          p.promo ? el('span', { class: 'promo-tag', text: 'Promo' }) : null,
        ]),
        el('div', { class: 'dish-body' }, [
          el('h3', { text: p.nom }),
          el('p', { text: p.description || '' }),
          el('div', { class: 'dish-foot' }, [el('span', { class: 'price', text: dt(p.prix) }), action]),
        ]),
      ])
    );
  });
}

/* ---------- Panier ---------- */
function rendrePanier() {
  const lignes = $('cart-lines');
  lignes.innerHTML = '';
  state.panier.forEach((q, id) => {
    const p = platParId(id);
    if (!p) return;
    lignes.append(
      el('li', { class: 'cart-line' }, [
        el('span', { class: 'emoji', text: p.icone }),
        el('div', {}, [el('div', { class: 'name', text: p.nom }), el('div', { class: 'sub', text: dt(p.prix * q) })]),
        stepper(id, q),
      ])
    );
  });
  if (!lignes.children.length) {
    lignes.append(el('li', { class: 'cart-empty' }, [el('div', { text: '🛒' }), document.createTextNode('Votre panier est vide.')]));
  }

  document.querySelectorAll('.mode-btn').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.mode === state.mode)));

  const { sousTotal, frais, total, articles } = calculTotaux();
  $('sous-total').textContent = dt(sousTotal);
  const fraisEl = $('frais');
  fraisEl.className = '';
  if (state.mode === 'emporter') fraisEl.textContent = 'Aucuns frais';
  else if (!sousTotal) fraisEl.textContent = '—';
  else if (frais) fraisEl.textContent = dt(frais);
  else {
    fraisEl.textContent = 'Offerte';
    fraisEl.className = 'free';
  }
  $('total').textContent = dt(total);

  const free = $('free-delivery');
  free.hidden = state.mode !== 'livraison';
  const reste = state.seuil - sousTotal;
  free.classList.toggle('ok', reste <= 0);
  $('free-text').textContent =
    reste <= 0 ? '🎉 Livraison offerte !' : `Plus que ${dt(reste)} pour la livraison offerte`;
  $('free-bar').style.width = `${Math.min(100, (sousTotal / state.seuil) * 100)}%`;

  $('vider').hidden = !articles;
  $('checkout-btn').disabled = !articles;
  $('checkout-btn').textContent = articles ? `Commander · ${dt(total)}` : 'Commander';

  $('mobile-cart').hidden = !articles;
  $('mobile-count').textContent = articles;
  $('mobile-total').textContent = dt(total);
}

document.querySelectorAll('.mode-btn').forEach((b) =>
  b.addEventListener('click', () => {
    state.mode = b.dataset.mode;
    sauverPanier();
    rendrePanier();
  })
);

$('vider').addEventListener('click', () => {
  state.panier.clear();
  sauverPanier();
  rendrePlats();
  rendrePanier();
});

/* ---------- Commande ---------- */
const checkoutDialog = $('checkout-dialog');
const checkoutForm = $('checkout-form');

$('checkout-btn').addEventListener('click', () => {
  const livraison = state.mode === 'livraison';
  $('adresse-field').hidden = !livraison;
  $('adresse').required = livraison;
  $('checkout-mode').textContent = livraison ? '🛵 Livraison à domicile' : '🛍️ À emporter';
  $('checkout-total').textContent = dt(calculTotaux().total);
  checkoutDialog.showModal();
  $('prenom').focus();
});
$('checkout-close').addEventListener('click', () => checkoutDialog.close());

checkoutForm.addEventListener('input', (e) => e.target.closest('.field')?.classList.remove('invalid'));

checkoutForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  let firstInvalid = null;
  ['prenom', 'nom', 'telephone', 'email', 'adresse', 'note'].forEach((id) => {
    const input = $(id);
    if (input.closest('.field').hidden) return;
    const ok = input.checkValidity() && (!input.required || input.value.trim());
    input.closest('.field').classList.toggle('invalid', !ok);
    if (!ok && !firstInvalid) firstInvalid = input;
  });
  if (firstInvalid) {
    toast('Veuillez compléter correctement vos coordonnées.');
    firstInvalid.focus();
    return;
  }

  const btn = $('confirm-btn');
  btn.classList.add('loading');
  btn.disabled = true;
  try {
    const result = await api('/api/commandes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_prenom: $('prenom').value.trim(),
        client_nom: $('nom').value.trim(),
        client_telephone: $('telephone').value.trim(),
        client_email: $('email').value.trim(),
        mode: state.mode,
        adresse: $('adresse').value.trim(),
        note: $('note').value.trim(),
        lignes: [...state.panier].map(([plat_id, quantite]) => ({ plat_id, quantite })),
      }),
    });
    checkoutDialog.close();
    $('success-text').textContent =
      state.mode === 'livraison'
        ? `Merci ${$('prenom').value.trim()} ! Votre commande arrive dans ${result.delai}.`
        : `Merci ${$('prenom').value.trim()} ! Votre commande sera prête dans ${result.delai}.`;
    $('success-ref').textContent = `Commande ${result.reference} · ${dt(result.total)} à régler à la réception`;
    $('success-dialog').showModal();

    state.panier.clear();
    sauverPanier();
    $('note').value = '';
    rendrePlats();
    rendrePanier();
    chargerCommandes().catch(() => {});
  } catch (err) {
    toast(err.message);
  } finally {
    btn.classList.remove('loading');
    btn.disabled = false;
  }
});

$('success-close').addEventListener('click', () => {
  $('success-dialog').close();
  $('commandes').scrollIntoView({ behavior: 'smooth' });
});

/* ---------- Dernières commandes ---------- */
async function chargerCommandes() {
  const commandes = await api('/api/commandes');
  const grid = $('cmd-list');
  $('cmd-count').textContent = commandes.length;
  grid.innerHTML = '';
  if (!commandes.length) {
    grid.append(el('div', { class: 'empty-state', text: 'Aucune commande pour le moment. Soyez le premier ! 🍕' }));
    return;
  }
  commandes.forEach((c, i) => {
    const heure = c.created_at.slice(11, 16);
    grid.append(
      el('article', { class: 'order', style: `animation-delay:${Math.min(i, 10) * 40}ms` }, [
        el('div', { class: 'order-top' }, [
          el('span', { class: 'order-ref', text: c.reference }),
          el('span', { class: 'status', text: c.statut }),
        ]),
        el('p', { class: 'items', text: c.articles }),
        el('div', { class: 'order-foot' }, [
          el('span', {
            text: `${c.client_prenom} ${c.client_nom[0]}. · ${c.mode === 'livraison' ? '🛵 Livraison' : '🛍️ À emporter'} · ${heure}`,
          }),
          el('strong', { text: dt(c.total) }),
        ]),
      ])
    );
  });
}

/* ---------- Infos serveur (instance derrière l'ALB, état RDS) ---------- */
async function chargerInfo() {
  try {
    const info = await api('/api/info');
    $('info-instance').textContent = info.instance;
    $('info-db').textContent = info.db;
    state.frais = info.frais_livraison;
    state.seuil = info.seuil_livraison_offerte;
    document.querySelectorAll('.seuil').forEach((s) => (s.textContent = `${state.seuil} DT`));
    rendrePanier();
  } catch {
    $('info-instance').textContent = '?';
    $('info-db').textContent = '?';
  }
}

/* ---------- Démarrage ---------- */
async function chargerMenu() {
  const [categories, plats] = await Promise.all([api('/api/categories'), api('/api/plats')]);
  state.categories = categories;
  state.plats = plats;
  // Retirer du panier les plats qui ne sont plus au menu
  [...state.panier.keys()].forEach((id) => platParId(id) || state.panier.delete(id));
  rendreCategories();
  rendrePlats();
  rendrePanier();
}

restaurerPanier();
rendrePanier();
chargerInfo();
Promise.all([chargerMenu(), chargerCommandes()]).catch((e) => {
  $('plats').innerHTML = '';
  $('plats').append(el('div', { class: 'empty-state', text: `Impossible de charger le menu : ${e.message}` }));
  toast(`Impossible de charger les données : ${e.message}`);
});
