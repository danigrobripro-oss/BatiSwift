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

// ─── INIT DASHBOARD ─────────────────────────────────────────
async function initDashboard() {
  const el = document.getElementById('dashboard-root');
  if (!el) return;

  // Auth obligatoire
  currentUser = await Session.requireAuth('/connexion.html');
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
async function refreshLeads() {
  try {
    const data = await API.get('/api/artisan/leads');
    availableLeads = data.available || [];
    purchasedLeads = data.purchased || [];
    renderAvailableLeads();
    renderPurchasedLeads();
    updateCounters();
  } catch (err) {
    toast('Impossible de charger les leads.', 'danger');
  }
}

function updateCounters() {
  const cAvail = document.getElementById('count-available');
  const cPurch = document.getElementById('count-purchased');
  if (cAvail) cAvail.textContent = availableLeads.length;
  if (cPurch) cPurch.textContent = purchasedLeads.length;
}

// ─── RENDER LEADS DISPONIBLES ───────────────────────────────
function renderAvailableLeads() {
  const container = document.getElementById('leads-available');
  if (!container) return;

  if (!availableLeads.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🔍</div>
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
  const container = document.getElementById('leads-purchased');
  if (!container) return;

  if (!purchasedLeads.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">💼</div>
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
  const urg   = URGENCE_LABEL[lead.urgence] || URGENCE_LABEL.normale;
  const emoji = TRAVAUX_EMOJI[lead.type_travaux] || '🏗️';
  const tags  = (lead.tags || []).map(t => `<span class="badge badge-neutral">${t}</span>`).join('');

  const contactBlock = withContact ? `
    <div class="lead-contact-box">
      <a href="tel:${lead.client_telephone}" class="btn btn-primary btn-sm">📞 ${lead.client_telephone}</a>
      <span>${lead.client_nom}</span>
    </div>` : '';

  const actionBlock = withContact
    ? `<button class="btn btn-secondary btn-sm" data-tag-lead="${lead.id}">🏷 Ajouter tag</button>`
    : `<button class="btn btn-gold btn-sm" data-buy="${lead.id}">Acheter — 10€</button>`;

  return `
    <article class="lead-card fade-in">
      <div class="lead-card-header">
        <div>
          <h4 class="lead-card-title">${emoji} ${capitalize(lead.type_travaux || 'Travaux')}</h4>
          <div class="lead-card-meta">
            <span class="badge ${urg.class}">${urg.label}</span>
            <span class="badge badge-neutral">📍 ${lead.client_ville || '—'}</span>
            ${lead.statut === 'acheté' ? '<span class="badge badge-success">✅ Acheté</span>' : ''}
          </div>
        </div>
        <span class="lead-date"><small>${fmtDate(lead.date_creation)}</small></span>
      </div>
      <p class="lead-card-description">${lead.description || 'Aucune description.'}</p>
      ${tags ? `<div class="lead-tags">${tags}</div>` : ''}
      ${contactBlock}
      <div class="lead-card-footer">
        ${withContact ? '<span></span>' : '<span class="lead-price">10 €</span>'}
        ${actionBlock}
      </div>
    </article>`;
}

// ─── MODAL ACHAT ────────────────────────────────────────────
function openBuyModal(leadId) {
  selectedLeadId = leadId;
  const lead = availableLeads.find(l => l.id === leadId);
  if (!lead) return;

  const info = document.getElementById('modal-lead-info');
  if (info) {
    const emoji = TRAVAUX_EMOJI[lead.type_travaux] || '🏗️';
    info.innerHTML = `
      <p><strong>${emoji} ${capitalize(lead.type_travaux)}</strong></p>
      <p>📍 ${lead.client_ville}</p>
      <p>${lead.description?.slice(0,120)}...</p>`;
  }
  openModal('modal-buy');
}

// ─── PAIEMENT STRIPE ────────────────────────────────────────
async function initStripePayment() {
  const btn = document.getElementById('btn-confirm-buy');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    if (!selectedLeadId) return;
    btnLoading(btn, true);

    try {
      const data = await API.post('/api/create-payment-intent', { lead_id: selectedLeadId });

      if (data.publishable_key && data.client_secret) {
        // Chargement Stripe.js dynamique
        if (typeof Stripe === 'undefined') {
          const s = document.createElement('script');
          s.src = 'https://js.stripe.com/v3/';
          s.onload = () => confirmStripePayment(data.publishable_key, data.client_secret, btn);
          document.head.appendChild(s);
        } else {
          confirmStripePayment(data.publishable_key, data.client_secret, btn);
        }
      } else {
        // Pas de Stripe configuré → simulation
        simulatePayment(btn);
      }
    } catch (err) {
      toast(err.message, 'danger');
      btnLoading(btn, false);
    }
  });
}

async function confirmStripePayment(pk, clientSecret, btn) {
  const stripe  = Stripe(pk);
  const { error } = await stripe.confirmCardPayment(clientSecret, {
    payment_method: { card: { token: 'tok_visa' } }   // en test seulement
  });
  if (error) {
    toast(error.message, 'danger');
    btnLoading(btn, false);
  } else {
    paymentSuccess();
  }
}

function simulatePayment(btn) {
  // Mode test sans clé Stripe
  setTimeout(() => {
    paymentSuccess();
    btnLoading(btn, false);
  }, 1200);
}

function paymentSuccess() {
  closeModal('modal-buy');
  toast('✅ Lead acheté ! Les coordonnées client sont dans "Mes leads".', 'success', 5000);
  setTimeout(refreshLeads, 1000);
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