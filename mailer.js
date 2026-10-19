const nodemailer = require('nodemailer');
const config = require('./mail.config');

const smtpActif = Boolean(config.host);

const transporter = smtpActif
  ? nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.user ? { user: config.user, pass: config.pass } : undefined,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    })
  : nodemailer.createTransport({ jsonTransport: true });

function echapper(texte) {
  return String(texte ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function formatDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

// rdv : { patient_prenom, patient_nom, patient_email, date_rdv, heure_rdv, motif, medecin_prenom, medecin_nom, specialite }
async function envoyerConfirmation(rdv) {
  const date = formatDate(rdv.date_rdv);
  const medecin = `Dr ${rdv.medecin_prenom} ${rdv.medecin_nom}`;

  const lignes = [
    ['Médecin', medecin],
    ['Spécialité', rdv.specialite],
    ['Date', date],
    ['Heure', rdv.heure_rdv],
  ];
  if (rdv.motif) lignes.push(['Motif', rdv.motif]);

  const text = [
    `Bonjour ${rdv.patient_prenom} ${rdv.patient_nom},`,
    '',
    'Votre rendez-vous est confirmé :',
    ...lignes.map(([k, v]) => `- ${k} : ${v}`),
    '',
    "Merci de vous présenter 10 minutes avant l'heure du rendez-vous.",
    '',
    "L'équipe MediRDV",
  ].join('\n');

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;background:#f4f7fb;padding:24px">
    <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #e3e8ef">
      <div style="background:linear-gradient(135deg,#0d9488,#6366f1);color:#fff;padding:24px">
        <div style="font-size:20px;font-weight:bold">MediRDV</div>
        <div style="font-size:15px;opacity:.9;margin-top:4px">Votre rendez-vous est confirmé ✔</div>
      </div>
      <div style="padding:24px;color:#0f172a">
        <p style="margin:0 0 16px">Bonjour <strong>${echapper(rdv.patient_prenom)} ${echapper(rdv.patient_nom)}</strong>,</p>
        <p style="margin:0 0 16px">Nous avons le plaisir de vous confirmer votre rendez-vous :</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          ${lignes
            .map(
              ([k, v]) => `<tr>
            <td style="padding:10px 0;border-bottom:1px dashed #e3e8ef;color:#64748b">${k}</td>
            <td style="padding:10px 0;border-bottom:1px dashed #e3e8ef;text-align:right;font-weight:bold">${echapper(v)}</td>
          </tr>`
            )
            .join('')}
        </table>
        <p style="margin:20px 0 0;font-size:14px;color:#64748b">Merci de vous présenter 10 minutes avant l'heure du rendez-vous.</p>
      </div>
    </div>
  </div>`;

  const info = await transporter.sendMail({
    from: config.from,
    to: rdv.patient_email,
    subject: `Confirmation de votre rendez-vous du ${date} à ${rdv.heure_rdv}`,
    text,
    html,
  });

  if (!smtpActif) {
    console.log(`[email non envoyé — SMTP non configuré dans mail.config.js] À : ${rdv.patient_email}\n${text}\n`);
  }
  return info;
}

module.exports = { envoyerConfirmation, smtpActif };
