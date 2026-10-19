const $ = (id) => document.getElementById(id);

const state = { specialite: null, medecin: null, date: null, heure: null };

const JOURS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const AVATAR_COLORS = ['#0d9488', '#6366f1', '#f59e0b', '#ec4899', '#0ea5e9', '#8b5cf6', '#10b981', '#ef4444'];

const ICONS = {
  generale: '<path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 12 0V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3"/><path d="M8 15v1a6 6 0 0 0 12 0v-4"/><circle cx="20" cy="10" r="2"/>',
  cardio: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
  dermato: '<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/>',
  pediatr: '<circle cx="12" cy="12" r="9"/><path d="M9 10h.01M15 10h.01M9.5 15a3.5 3.5 0 0 0 5 0"/>',
  ophtalmo: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
  gyneco: '<circle cx="12" cy="9" r="6"/><path d="M12 15v7M9 19h6"/>',
  default: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
};

function iconFor(nom) {
  const n = nom.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const key = Object.keys(ICONS).find((k) => n.includes(k));
  return `<svg viewBox="0 0 24 24">${ICONS[key || 'default']}</svg>`;
}

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === 'text') node.textContent = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  });
  children.forEach((c) => c && node.append(c));
  return node;
}

function toISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDateLong(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

function initiales(m) {
  return `${m.prenom[0] || ''}${m.nom[0] || ''}`.toUpperCase();
}

let toastTimer;
function toast(text) {
  const t = $('toast');
  t.textContent = text;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 4000);
}

async function api(url, options) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Erreur inattendue');
  return data;
}

function selectIn(container, button) {
  container.querySelectorAll('[aria-checked]').forEach((b) => b.setAttribute('aria-checked', 'false'));
  button.setAttribute('aria-checked', 'true');
}

/* ---------- Étapes & récapitulatif ---------- */
function refreshUI() {
  const done = [!!state.specialite, !!state.medecin, !!(state.date && state.heure)];
  const firstOpen = done.indexOf(false);
  [1, 2, 3, 4].forEach((n) => {
    const step = $(`step-${n}`);
    const unlocked = n === 1 || done[n - 2];
    let s = 'locked';
    if (unlocked) s = n <= 3 && done[n - 1] ? 'done' : 'active';
    if (unlocked && firstOpen !== -1 && n - 1 > firstOpen) s = 'locked';
    step.dataset.state = s;
  });

  $('sum-spec').textContent = state.specialite ? state.specialite.nom : '—';
  $('sum-doc').textContent = state.medecin ? `Dr ${state.medecin.prenom} ${state.medecin.nom}` : '—';
  $('sum-date').textContent = state.date ? formatDateLong(state.date) : '—';
  $('sum-heure').textContent = state.heure || '—';

  const filled = ['prenom', 'nom', 'email'].every((id) => $(id).value.trim());
  const progress = done.filter(Boolean).length + (filled ? 1 : 0);
  $('progress-bar').style.width = `${(progress / 4) * 100}%`;
  $('submit-btn').disabled = !done.every(Boolean);
}

/* ---------- Spécialités ---------- */
async function chargerSpecialites() {
  const specialites = await api('/api/specialites');
  const grid = $('specialites');
  grid.innerHTML = '';
  specialites.forEach((s) => {
    const btn = el('button', {
      type: 'button',
      class: 'tile',
      role: 'radio',
      'aria-checked': 'false',
      onclick: () => {
        selectIn(grid, btn);
        state.specialite = s;
        state.medecin = state.date = state.heure = null;
        chargerMedecins().catch((e) => toast(e.message));
        resetCreneaux();
        refreshUI();
      },
    }, [
      el('span', { class: 'tile-icon', html: iconFor(s.nom) }),
      el('span', { class: 'tile-title', text: s.nom }),
    ]);
    grid.append(btn);
  });
}

/* ---------- Médecins ---------- */
async function chargerMedecins() {
  const grid = $('medecins');
  grid.innerHTML = '<div class="skeleton"></div><div class="skeleton"></div>';
  const medecins = await api(`/api/medecins?specialite_id=${state.specialite.id}`);
  grid.innerHTML = '';
  if (!medecins.length) {
    grid.append(el('p', { class: 'hint', text: 'Aucun médecin disponible pour cette spécialité.' }));
    return;
  }
  medecins.forEach((m) => {
    const btn = el('button', {
      type: 'button',
      class: 'tile',
      role: 'radio',
      'aria-checked': 'false',
      onclick: () => {
        selectIn(grid, btn);
        state.medecin = m;
        state.heure = null;
        if (!state.date) {
          const first = $('jours').querySelector('.day');
          if (first) first.click();
        } else {
          chargerCreneaux().catch((e) => toast(e.message));
        }
        refreshUI();
      },
    }, [
      el('span', { class: 'avatar', text: initiales(m), style: `background:${AVATAR_COLORS[m.id % AVATAR_COLORS.length]}` }),
      el('span', {}, [
        el('span', { class: 'tile-title', text: `Dr ${m.prenom} ${m.nom}` }),
        el('br'),
        el('span', { class: 'tile-sub', text: m.specialite }),
      ]),
    ]);
    grid.append(btn);
  });
}

/* ---------- Jours ---------- */
function construireJours() {
  const container = $('jours');
  const d = new Date();
  let count = 0;
  while (count < 21) {
    if (d.getDay() !== 0) {
      const iso = toISO(d);
      const label = count === 0 && iso === toISO(new Date()) ? 'Auj.' : JOURS[d.getDay()];
      const btn = el('button', {
        type: 'button',
        class: 'day',
        role: 'radio',
        'aria-checked': 'false',
        'aria-label': formatDateLong(iso),
        onclick: () => {
          selectIn(container, btn);
          state.date = iso;
          state.heure = null;
          chargerCreneaux().catch((e) => toast(e.message));
          refreshUI();
        },
      }, [
        el('small', { text: label }),
        el('strong', { text: String(d.getDate()) }),
        el('small', { text: MOIS[d.getMonth()] }),
      ]);
      container.append(btn);
      count++;
    }
    d.setDate(d.getDate() + 1);
  }
  document.querySelectorAll('.scroll-btn').forEach((b) =>
    b.addEventListener('click', () => container.scrollBy({ left: Number(b.dataset.dir) * 240, behavior: 'smooth' }))
  );
}

/* ---------- Créneaux ---------- */
function resetCreneaux() {
  $('jours').querySelectorAll('[aria-checked]').forEach((b) => b.setAttribute('aria-checked', 'false'));
  $('creneaux').innerHTML = '<p class="hint">Choisissez un médecin puis une date.</p>';
}

async function chargerCreneaux() {
  const box = $('creneaux');
  if (!state.medecin || !state.date) return;
  box.innerHTML = '<div class="skeleton" style="height:44px"></div>';
  let creneaux = await api(`/api/medecins/${state.medecin.id}/creneaux?date=${state.date}`);

  // Masquer les créneaux déjà passés pour aujourd'hui
  if (state.date === toISO(new Date())) {
    const now = new Date();
    const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    creneaux = creneaux.filter((c) => c > hhmm);
  }

  box.innerHTML = '';
  if (!creneaux.length) {
    box.append(el('p', { class: 'hint', text: 'Aucun créneau disponible ce jour-là. Essayez une autre date.' }));
    return;
  }

  const groupes = [
    ['Matin', creneaux.filter((c) => c < '12:00')],
    ['Après-midi', creneaux.filter((c) => c >= '12:00')],
  ];
  groupes.forEach(([titre, liste]) => {
    if (!liste.length) return;
    const row = el('div', { class: 'slots-row', role: 'radiogroup', 'aria-label': titre });
    liste.forEach((c) => {
      const btn = el('button', {
        type: 'button',
        class: 'slot',
        role: 'radio',
        'aria-checked': 'false',
        text: c,
        onclick: () => {
          selectIn(box, btn);
          state.heure = c;
          refreshUI();
          if (window.innerWidth < 900) $('step-4').scrollIntoView({ behavior: 'smooth', block: 'start' });
          else $('prenom').focus({ preventScroll: true });
        },
      });
      row.append(btn);
    });
    box.append(el('div', { class: 'slots-group' }, [el('p', { class: 'slots-label', text: titre }), row]));
  });
}

/* ---------- Liste des rendez-vous ---------- */
async function chargerRendezVous() {
  const rdvs = await api('/api/rendez-vous');
  const grid = $('rdv-list');
  $('rdv-count').textContent = rdvs.length;
  grid.innerHTML = '';
  if (!rdvs.length) {
    grid.append(el('div', { class: 'empty-state', text: 'Aucun rendez-vous pour le moment.' }));
    return;
  }
  rdvs.forEach((r, i) => {
    const [, m, d] = r.date_rdv.split('-').map(Number);
    const card = el('article', { class: 'rdv-card', style: `animation-delay:${Math.min(i, 10) * 40}ms` }, [
      el('div', { class: 'rdv-date' }, [el('strong', { text: String(d) }), el('small', { text: MOIS[m - 1] })]),
      el('div', { class: 'rdv-body' }, [
        el('h4', { text: `${r.patient_prenom} ${r.patient_nom}` }),
        el('p', { text: `Dr ${r.medecin_prenom} ${r.medecin_nom} · ${r.specialite}` }),
        el('span', { class: 'chip', text: `🕒 ${r.heure_rdv}` }),
      ]),
    ]);
    grid.append(card);
  });
}

/* ---------- Soumission ---------- */
const form = $('rdv-form');
form.addEventListener('input', (e) => {
  e.target.closest('.field')?.classList.remove('invalid');
  refreshUI();
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  let firstInvalid = null;
  ['prenom', 'nom', 'email', 'telephone', 'motif'].forEach((id) => {
    const input = $(id);
    const ok = input.checkValidity() && (!input.required || input.value.trim());
    input.closest('.field').classList.toggle('invalid', !ok);
    if (!ok && !firstInvalid) firstInvalid = input;
  });
  if (firstInvalid) {
    toast('Veuillez compléter correctement vos coordonnées.');
    firstInvalid.focus();
    return;
  }

  const btn = $('submit-btn');
  btn.classList.add('loading');
  btn.disabled = true;
  try {
    const email = $('email').value.trim();
    const result = await api('/api/rendez-vous', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        medecin_id: state.medecin.id,
        date_rdv: state.date,
        heure_rdv: state.heure,
        motif: $('motif').value.trim(),
        patient_nom: $('nom').value.trim(),
        patient_prenom: $('prenom').value.trim(),
        patient_email: email,
        patient_telephone: $('telephone').value.trim(),
      }),
    });
    $('success-text').textContent =
      `Avec Dr ${state.medecin.prenom} ${state.medecin.nom}, ${formatDateLong(state.date)} à ${state.heure}.`;
    const emailBox = $('success-email');
    const messagesEmail = {
      envoye: `✉️ Un email de confirmation a été envoyé à ${email}.`,
      console: "SMTP non configuré : l'email a été affiché dans la console du serveur.",
      echec: "L'email de confirmation n'a pas pu être envoyé.",
    };
    emailBox.textContent = messagesEmail[result.email_statut] || messagesEmail.echec;
    emailBox.classList.toggle('warn', result.email_statut !== 'envoye');
    $('success-dialog').showModal();
    form.reset();
    state.heure = null;
    await Promise.all([chargerCreneaux(), chargerRendezVous()]);
  } catch (err) {
    toast(err.message);
    state.heure = null;
    chargerCreneaux().catch(() => {});
  } finally {
    btn.classList.remove('loading');
    refreshUI();
  }
});

$('dialog-close').addEventListener('click', () => {
  $('success-dialog').close();
  $('mes-rdv').scrollIntoView({ behavior: 'smooth' });
});

/* ---------- Démarrage ---------- */
construireJours();
refreshUI();
Promise.all([chargerSpecialites(), chargerRendezVous()]).catch((e) =>
  toast(`Impossible de charger les données : ${e.message}`)
);
