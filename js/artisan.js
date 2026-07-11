// BâtiSwift — Logique métier artisan (dashboard, leads, achat)

let stripeInstance = null;   // sera initialisé si nécessaire

function initStripe() {
  if (!stripeInstance && window.Stripe) {
    stripeInstance = Stripe(STRIPE_PUBLISHABLE_KEY);
  }
}

// Charger tous les leads (disponibles + achetés)
async function loadArtisanLeads() {
  if (!requireAuth()) return;
  try {
    const res = await fetch(`${API_BASE}/api/artisan/leads`, { credentials: 'include' });
    if (!res.ok) throw new Error('Erreur chargement leads');
    const data = await res.json();
    renderAvailableLeads(data.available || []);
    renderPurchasedLeads(data.purchased || []);
  } catch(e) {
    console.error(e);
  }
}

// Affichage des leads disponibles
function renderAvailableLeads(leads) {
  const container = document.getElementById('available-leads');
  if (!container) return;
  container.innerHTML = '';
  if (leads.length === 0) {
    container.innerHTML = '<p class="text-center mt-md">Aucun lead disponible pour le moment.</p>';
    return;
  }
  leads.forEach(lead => {
    const card = document.createElement('div');
    card.className = 'lead-card';
    card.innerHTML = `
      <div class="lead-card-header">
        <span class="badge ${getUrgenceClass(lead.urgence)}">${lead.urgence}</span>
        <span class="lead-price">10€</span>
      </div>
      <h4 class="lead-card-title">${lead.type_travaux || 'Travaux'} – ${lead.client_ville || 'Ville inconnue'}</h4>
      <p class="lead-card-description">${lead.description || ''}</p>
      <div class="lead-card-footer">
        <span class="badge badge-neutral">${lead.client_ville || ''}</span>
        <button class="btn btn-primary btn-sm buy-btn" data-lead-id="${lead.id}">Acheter</button>
      </div>
    `;
    container.appendChild(card);
  });
  // Attacher les événements d'achat
  document.querySelectorAll('.buy-btn').forEach(btn => {
    btn.addEventListener('click', () => buyLead(btn.dataset.leadId));
  });
}

function getUrgenceClass(urgence) {
  switch(urgence) {
    case 'immediate': return 'badge-danger';
    case 'normale': return 'badge-warning';
    case 'faible': return 'badge-success';
    default: return 'badge-neutral';
  }
}

// Affichage des leads achetés
function renderPurchasedLeads(leads) {
  const container = document.getElementById('purchased-leads');
  if (!container) return;
  container.innerHTML = '';
  if (leads.length === 0) {
    container.innerHTML = '<p class="text-center mt-md">Vous n\'avez encore acheté aucun lead.</p>';
    return;
  }
  leads.forEach(lead => {
    const card = document.createElement('div');
    card.className = 'lead-card';
    card.innerHTML = `
      <h4>${lead.client_nom || 'Client'} – ${lead.client_ville}</h4>
      <p><strong>Tél :</strong> ${lead.client_telephone || 'Non renseigné'}</p>
      <p class="lead-card-description">${lead.description}</p>
      <div class="lead-card-footer">
        <span class="badge badge-neutral">Acheté</span>
        <small>${new Date(lead.date_creation).toLocaleDateString('fr')}</small>
      </div>
    `;
    container.appendChild(card);
  });
}

// Achat d'un lead via Stripe
async function buyLead(leadId) {
  if (!requireAuth()) return;
  initStripe();
  try {
    const res = await fetch(`${API_BASE}/api/create-payment-intent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lead_id: leadId }),
      credentials: 'include'
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur création paiement');
    const { client_secret } = data;
    const { error } = await stripeInstance.confirmPayment({
      clientSecret: client_secret,
      confirmParams: {
        return_url: window.location.href,
      },
    });
    if (error) {
      alert('Paiement échoué : ' + error.message);
    } else {
      alert('Paiement réussi !');
      loadArtisanLeads(); // recharger
    }
  } catch(e) {
    alert(e.message);
  }
}