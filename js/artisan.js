/**
 * BâtiSwift — artisan.js
 * Logique métier du dashboard artisan.
 * Leads disponibles, leads achetés, paiement Stripe, tags.
 */

// ─── ÉTAT GLOBAL ────────────────────────────────────────────
let currentUser   = null;
let availableLeads = [];
let purchasedLeads = [];
let selectedLeadId = null;

// ─── HELPERS (utilisés par leadCard / openBuyModal) ──────────
// Valeurs réelles du backend : urgence = immediate | normale | faible
//                              type_travaux = plomberie | electricite | peinture | maconnerie | chauffage | serrurerie | autre
var URGENCE_LABEL = {
  immediate: { label: '<svg class="bs-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><use href="#ic-siren"/></svg> Urgent',   class: 'badge-danger'  },
  normale:   { label: '<svg class="bs-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><use href="#ic-calendar"/></svg> Normal',   class: 'badge-neutral' },
  faible:    { label: '<svg class="bs-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><use href="#ic-clock"/></svg> Flexible', class: 'badge-neutral' }
};
URGENCE_LABEL.urgent   = URGENCE_LABEL.immediate;
URGENCE_LABEL.normal   = URGENCE_LABEL.normale;
URGENCE_LABEL.flexible = URGENCE_LABEL.faible;

var TRAVAUX_EMOJI = {
  plomberie: '<svg class="bs-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><use href="#ic-briefcase"/></svg>',
  electricite: '<svg class="bs-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><use href="#ic-lightning"/></svg>',
  peinture: '<svg class="bs-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><use href="#ic-briefcase"/></svg>',
  maconnerie: '<svg class="bs-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><use href="#ic-briefcase"/></svg>',
  chauffage: '<svg class="bs-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><use href="#ic-fire"/></svg>',
  serrurerie: '<svg class="bs-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><use href="#ic-lock"/></svg>',
  autre: '<svg class="bs-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><use href="#ic-briefcase"/></svg>'
};

var capitalize = (typeof window.capitalize === 'function') ? window.capitalize : function(s) {
  s = String(s == null ? '' : s);
  return s.charAt(0).toUpperCase() + s.slice(1);
};

var fmtDate = (typeof window.fmtDate === 'function') ? window.fmtDate : function(iso) {
  if (!iso) return '';
  var d = new Date(iso);
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
};

// Échappement HTML : description / nom / ville viennent des clients (contenu non fiable)
var esc = (typeof window.esc === 'function') ? window.esc : function(v) {
  return String(v == null ? '' : v).replace(/[&<>"']/g, function(c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c];
  });
};

// ─── INIT DASHBOARD ─────────────────────────────────────────
async function initDashboard() {
  const el = document.getElementById('dashboard-root');
  if (!el) return;

  // Auth obligatoire
  // Espace artisan : rôle vérifié (un client est redirigé, sans appel API inutile)
  currentUser = await Session.requireRole('artisan');
  if (!currentUser) return;

  // Affiche le nom
  const nameEl = document.getElementById('artisan-name');
  if (nameEl) nameEl.textContent = currentUser.nom;

  // Charge les leads
  await refreshLeads();

  // Stats live
  await loadStats();

  // Onglets
  initTabs();
}

// ─── CHARGER LES LEADS ──────────────────────────────────────
let _refreshing = null;
function refreshLeads() {
  // Un seul appel réseau à la fois (initDashboard + dashboard.html appellent tous deux cette fonction)
  if (_refreshing) return _refreshing;
  _refreshing = (async () => {
    let data;
    try {
      data = await API.get('/api/artisan/leads');
    } catch (err) {
      // On affiche la vraie raison renvoyée par le serveur (ex. email non confirmé, rôle)
      toast(err.message || 'Impossible de charger les leads.', 'danger', 6000);
      return;
    }
    availableLeads = Array.isArray(data.available) ? data.available : [];
    purchasedLeads = Array.isArray(data.purchased) ? data.purchased : [];
    try {
      renderAvailableLeads();
      renderPurchasedLeads();
      updateCounters();
    } catch (err) {
      console.error('[artisan.js] Affichage des leads impossible :', err);
      toast("Les leads ont été reçus mais n'ont pas pu être affichés.", 'danger', 6000);
    }
  })().finally(() => { _refreshing = null; });
  return _refreshing;
}

// Nom appelé par dashboard.html
function loadArtisanLeads() { return refreshLeads(); }

function updateCounters() {
  const cAvail = document.getElementById('count-available');
  const cPurch = document.getElementById('count-purchased');
  if (cAvail) cAvail.textContent = availableLeads.length;
  if (cPurch) cPurch.textContent = purchasedLeads.length;
  // KPI du tableau de bord : valeurs réelles (dans le rayon de l'artisan)
  const kAvail = document.getElementById('kpi-leads-dispo');
  const kPurch = document.getElementById('kpi-leads-achetes');
  if (kAvail) kAvail.textContent = availableLeads.length;
  if (kPurch) kPurch.textContent = purchasedLeads.length;
}

// ─── RENDER LEADS DISPONIBLES ───────────────────────────────
function renderAvailableLeads() {
  const container = document.getElementById('leads-available') || document.getElementById('available-leads');
  if (!container) return;

  if (!availableLeads.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon" aria-hidden="true"><svg class="bs-icon" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><use href="#ic-search"/></svg></div>
        <h3>Aucun lead disponible</h3>
        <p>De nouvelles demandes clients arrivent chaque heure.</p>
      </div>`;
    return;
  }

  container.innerHTML = availableLeads.map(lead => leadCard(lead, false)).join('');

  // Boutons acheter
  container.querySelectorAll('[data-buy]').forEach(btn => {
    btn.addEventListener('click', () => openBuyModal(parseInt(btn.dataset.buy)));
  });
}

// ─── RENDER LEADS ACHETÉS ───────────────────────────────────
function renderPurchasedLeads() {
  const container = document.getElementById('leads-purchased') || document.getElementById('purchased-leads');
  if (!container) return;

  if (!purchasedLeads.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon" aria-hidden="true"><svg class="bs-icon" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><use href="#ic-briefcase"/></svg></div>
        <h3>Aucun lead acheté</h3>
        <p>Achetez votre premier lead pour 10€ et commencez à travailler.</p>
      </div>`;
    return;
  }

  container.innerHTML = purchasedLeads.map(lead => leadCard(lead, true)).join('');

  // Boutons tag
  container.querySelectorAll('[data-tag-lead]').forEach(btn => {
    btn.addEventListener('click', () => openTagModal(parseInt(btn.dataset.tagLead)));
  });
}

// ─── CARD HTML ──────────────────────────────────────────────
function leadCard(lead, withContact) {
  const urg    = URGENCE_LABEL[lead.urgence] || URGENCE_LABEL.normale;
  const emoji  = TRAVAUX_EMOJI[lead.type_travaux] || TRAVAUX_EMOJI.autre;
  const tags   = (lead.tags || []).map(t => `<span class="badge badge-neutral">${esc(t)}</span>`).join('');
  const id     = Number(lead.id);
  const titre  = esc(capitalize(lead.type_travaux || 'Travaux'));
  const ville  = esc(lead.client_ville || '—');
  const desc   = esc(lead.description || 'Aucune description.');
  const date   = esc(fmtDate(lead.date_creation));

  if (withContact) {
    // Après achat : afficher toutes les infos
    const tel     = String(lead.client_telephone || '');
    const telHref = tel.replace(/[^\d+]/g, '');
    const contactBlock = `
      <div class="lead-contact-box" style="background:var(--beige);padding:12px;border-radius:12px;margin:8px 0;">
        <p><strong><svg class="bs-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><use href="#ic-user"/></svg> Client :</strong> ${esc(lead.client_nom || 'Non renseigné')}</p>
        <p><strong><svg class="bs-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><use href="#ic-phone"/></svg> Téléphone :</strong> <a href="tel:${esc(telHref)}" style="color:var(--anthracite);font-weight:600;">${esc(tel || 'Non renseigné')}</a></p>
        ${lead.adresse ? `<p><strong><svg class="bs-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><use href="#ic-location-pin"/></svg> Adresse :</strong> ${esc(lead.adresse)}</p>` : ''}
      </div>`;

    return `
      <article class="lead-card fade-in">
        <div class="lead-card-header">
          <div>
            <h4 class="lead-card-title">${emoji} ${titre}</h4>
            <div class="lead-card-meta">
              <span class="badge ${urg.class}">${urg.label}</span>
              <span class="badge badge-neutral"><svg class="bs-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><use href="#ic-location-pin"/></svg> ${ville}</span>
              <span class="badge badge-success"><svg class="bs-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><use href="#ic-check"/></svg> Acheté</span>
            </div>
          </div>
          <span class="lead-date"><small>${date}</small></span>
        </div>
        <p class="lead-card-description">${desc}</p>
        ${tags ? `<div class="lead-tags">${tags}</div>` : ''}
        ${contactBlock}
        <div class="lead-card-footer">
          <span></span>
          <button class="btn btn-secondary btn-sm" data-tag-lead="${id}"><svg class="bs-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><use href="#ic-tarifs"/></svg> Ajouter tag</button>
        </div>
      </article>`;
  } else {
    // Avant achat : masquer les informations sensibles
    const maskedContact = `
      <div class="lead-contact-box" style="background:var(--beige);padding:12px;border-radius:12px;margin:8px 0;">
        <p><strong><svg class="bs-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><use href="#ic-user"/></svg> Client :</strong> Client vérifié #${String(id).padStart(4, '0')}</p>
        <p><strong><svg class="bs-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><use href="#ic-phone"/></svg> Téléphone :</strong> 06 XX XX XX XX</p>
        <p style="color:var(--success);margin-top:6px;font-weight:500;">
          <svg class="bs-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><use href="#ic-lock"/></svg> Lead 100% vérifié par notre Agent IA. Numéro et adresse débloqués instantanément après validation du paiement sécurisé par Stripe.
        </p>
      </div>`;

    // Détails techniques (surface, budget) si disponibles
    const details = [];
    if (lead.surface_estimee) details.push(`<span class="badge badge-neutral"><svg class="bs-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><use href="#ic-list"/></svg> ${esc(lead.surface_estimee)} m²</span>`);
    if (lead.budget_estime)  details.push(`<span class="badge badge-neutral"><svg class="bs-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><use href="#ic-money"/></svg> ${esc(lead.budget_estime)}€</span>`);
    const detailsBlock = details.length ? `<div class="lead-card-meta" style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:8px;">${details.join('')}</div>` : '';

    return `
      <article class="lead-card fade-in">
        <div class="lead-card-header">
          <div>
            <h4 class="lead-card-title">${emoji} ${titre}</h4>
            <div class="lead-card-meta">
              <span class="badge ${urg.class}">${urg.label}</span>
              <span class="badge badge-neutral"><svg class="bs-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><use href="#ic-location-pin"/></svg> ${ville}</span>
            </div>
          </div>
          <span class="lead-date"><small>${date}</small></span>
        </div>
        <p class="lead-card-description">${desc}</p>
        ${detailsBlock}
        ${maskedContact}
        <div class="lead-card-footer">
          <span class="lead-price">10 €</span>
          <button class="btn btn-gold btn-sm" data-buy="${id}">Acheter — 10€</button>
        </div>
      </article>`;
  }
}

// ─── MODAL ACHAT ────────────────────────────────────────────
function openBuyModal(leadId) {
  selectedLeadId = leadId;
  const lead = availableLeads.find(l => l.id === leadId);
  if (!lead) return;

  const info = document.getElementById('modal-lead-info');
  if (info) {
    const emoji = TRAVAUX_EMOJI[lead.type_travaux] || TRAVAUX_EMOJI.autre;
    info.innerHTML = `
      <p><strong>${emoji} ${esc(capitalize(lead.type_travaux))}</strong></p>
      <p><svg class="bs-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><use href="#ic-location-pin"/></svg> ${esc(lead.client_ville)}</p>
      <p>${esc((lead.description || '').slice(0, 120))}${(lead.description || '').length > 120 ? '…' : ''}</p>`;
  }
  openModal('modal-buy');
}

// ─── PAIEMENT STRIPE ────────────────────────────────────────
// Le paiement réel (Stripe Elements + PaymentIntent + confirmation par webhook)
// se fait UNIQUEMENT sur /marketplace.html. Ce tableau de bord n'affiche donc
// plus de succès « simulé » : aucun lead n'est considéré acheté tant que le
// serveur (webhook Stripe) ne l'a pas attribué.
function initStripePayment() {
  const btn = document.getElementById('btn-confirm-buy');
  if (!btn) return;

  btn.addEventListener('click', () => {
    if (!selectedLeadId) return;
    window.location.href = '/marketplace.html?lead=' + encodeURIComponent(selectedLeadId);
  });
}

// ─── MODAL TAG ───────────────────────────────────────────────
function openTagModal(leadId) {
  selectedLeadId = leadId;
  openModal('modal-tag');
}

async function submitTag() {
  const tagInput = document.getElementById('tag-input');
  if (!tagInput || !selectedLeadId) return;
  const tag = tagInput.value.trim();
  if (!tag) return;

  try {
    const data = await API.post(`/api/leads/${selectedLeadId}/tag`, { tag });
    toast('Tag ajouté !', 'success');
    closeModal('modal-tag');
    tagInput.value = '';
    await refreshLeads();
  } catch (err) {
    toast(err.message, 'danger');
  }
}

// ─── ONGLETS ─────────────────────────────────────────────────
function initTabs() {
  const tabs    = document.querySelectorAll('[data-tab]');
  const panels  = document.querySelectorAll('[data-panel]');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      tabs.forEach(t => t.classList.remove('active'));
      panels.forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.querySelector(`[data-panel="${target}"]`)?.classList.add('active');
    });
  });
}

// ─── PAGE PROFIL ─────────────────────────────────────────────
async function initProfil() {
  if (!document.getElementById('form-profil')) return;
  currentUser = await Session.requireAuth();
  if (!currentUser) return;

  // Pré-remplissage
  const fields = ['nom','email','telephone','ville','rayon','specialite'];
  fields.forEach(f => {
    const el = document.getElementById(`profil-${f}`);
    if (el && currentUser[f] !== undefined) el.value = currentUser[f];
  });

  document.getElementById('form-profil').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-save-profil');
    btnLoading(btn, true);
    const body = {};
    fields.forEach(f => {
      const el = document.getElementById(`profil-${f}`);
      if (el && el.value.trim()) body[f] = el.value.trim();
    });
    const pw = document.getElementById('profil-password')?.value;
    if (pw && pw.length >= 6) body.password = pw;
    try {
      const data = await API.put('/api/artisan/profile', body);
      if (data.token) { Session.save(data.token, data.artisan); currentUser = data.artisan; }
      toast('Profil mis à jour !', 'success');
    } catch (err) {
      toast(err.message, 'danger');
    } finally {
      btnLoading(btn, false);
    }
  });
}

// ─── INIT ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initDashboard();
  initStripePayment();
  initProfil();

  // Bouton logout
  document.querySelectorAll('[data-action="logout"]').forEach(b => b.addEventListener('click', () => Session.logout()));

  // Bouton submit tag
  document.getElementById('btn-add-tag')?.addEventListener('click', submitTag);

  // Fermer modals
  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.closeModal));
  });
});