/* ============================================
   BâtiSwift - Script principal modulaire
   Gestion session, appels API, UI dynamique
   ============================================ */

// Configuration
const API_BASE = 'https://agent-btp.onrender.com'; // à ajuster selon déploiement
// Pour Stripe (clé publique) – à remplacer par variable d'env côté front
const STRIPE_PUBLISHABLE_KEY = 'pk_test_votre_cle';

// État global (session)
let currentUser = null; // { id, email, nom, telephone? }

// ===== Gestion de session (localStorage) =====
function loadSession() {
  const data = localStorage.getItem('batiswift_session');
  if (data) {
    try {
      currentUser = JSON.parse(data);
    } catch (e) {
      currentUser = null;
    }
  }
}

function saveSession(user) {
  currentUser = user;
  localStorage.setItem('batiswift_session', JSON.stringify(user));
}

function clearSession() {
  currentUser = null;
  localStorage.removeItem('batiswift_session');
}

// ===== Helpers API =====
async function apiFetch(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  // Si on a un token, on pourrait l'ajouter ici (mais on utilise les cookies de session Flask)
  // On ajoute credentials: 'include' pour les cookies
  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });
  if (!response.ok) {
    let errorMsg = `Erreur HTTP ${response.status}`;
    try {
      const errData = await response.json();
      if (errData.message) errorMsg = errData.message;
    } catch (_) {}
    throw new Error(errorMsg);
  }
  return response.json();
}

// ===== Fonctions API spécifiques =====

// Artisan : inscription
async function registerArtisan(email, password, nom, telephone) {
  const data = await apiFetch('/api/artisan/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, nom, telephone }),
  });
  return data; // { id, email, nom, ... }
}

// Artisan : connexion
async function loginArtisan(email, password) {
  const data = await apiFetch('/api/artisan/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  return data; // { id, email, nom, ... }
}

// Client : envoyer une demande (chat)
async function sendClientRequest(nom, telephone, description, localisation = '') {
  const data = await apiFetch('/api/client/request', {
    method: 'POST',
    body: JSON.stringify({ nom, telephone, description, localisation }),
  });
  return data;
}

// Récupérer les leads disponibles
async function fetchAvailableLeads() {
  const data = await apiFetch('/api/leads/available');
  return data; // tableau de leads
}

// Créer un PaymentIntent Stripe
async function createPaymentIntent(leadId, amount) {
  const data = await apiFetch('/api/create-payment-intent', {
    method: 'POST',
    body: JSON.stringify({ lead_id: leadId, amount }),
  });
  return data; // { clientSecret }
}

// ===== UI Helpers =====

function showSpinner(element) {
  element.innerHTML = `<span class="spinner"></span>`;
}

function hideSpinner(element) {
  element.innerHTML = '';
}

function showMessage(element, text, isError = false) {
  element.textContent = text;
  element.style.color = isError ? '#B00020' : 'inherit';
}

// ===== Initialisation des pages =====

// Page Index : rien de spécial, juste des liens
// Page Client : chat
// Page Artisan : dashboard ou login

// ===== Page Client =====
function initClientPage() {
  const form = document.getElementById('chat-form');
  const input = document.getElementById('client-message');
  const messagesContainer = document.getElementById('chat-messages');
  const sendBtn = document.getElementById('send-btn');

  if (!form) return;

  // Charger d'éventuels messages précédents (non persistant pour l'instant)
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const message = input.value.trim();
    if (!message) return;

    // Ajouter le message utilisateur
    appendMessage(messagesContainer, message, 'user');
    input.value = '';
    sendBtn.disabled = true;
    showSpinner(sendBtn);

    // Appel API
    try {
      // On suppose que le backend attend un champ "message" ou "description"
      // On utilise aussi des infos anonymes (nom, téléphone) si on veut les demander
      const response = await sendClientRequest(
        'Client anonyme', // ou un champ
        '0000000000',
        message
      );
      // Afficher la réponse (si retournée)
      const reply = response.reply || response.message || 'Demande enregistrée avec succès.';
      appendMessage(messagesContainer, reply, 'bot');
    } catch (error) {
      appendMessage(messagesContainer, `Erreur : ${error.message}`, 'bot');
    } finally {
      sendBtn.disabled = false;
      hideSpinner(sendBtn);
    }
  });

  function appendMessage(container, text, type) {
    const div = document.createElement('div');
    div.className = `message ${type}`;
    div.textContent = text;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }
}

// ===== Page Artisan =====
function initArtisanPage() {
  loadSession();

  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const showRegisterLink = document.getElementById('show-register');
  const showLoginLink = document.getElementById('show-login');
  const loginSection = document.getElementById('login-section');
  const registerSection = document.getElementById('register-section');
  const dashboardSection = document.getElementById('dashboard-section');
  const logoutBtn = document.getElementById('logout-btn');

  // Éléments du dashboard
  const leadsContainer = document.getElementById('leads-container');

  // Gestion des switchs
  if (showRegisterLink) {
    showRegisterLink.addEventListener('click', (e) => {
      e.preventDefault();
      loginSection.classList.add('hidden');
      registerSection.classList.remove('hidden');
    });
  }
  if (showLoginLink) {
    showLoginLink.addEventListener('click', (e) => {
      e.preventDefault();
      registerSection.classList.add('hidden');
      loginSection.classList.remove('hidden');
    });
  }

  // Inscription
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(registerForm);
      const email = formData.get('email');
      const password = formData.get('password');
      const nom = formData.get('nom');
      const telephone = formData.get('telephone');
      try {
        const user = await registerArtisan(email, password, nom, telephone);
        saveSession(user);
        showDashboard();
        alert('Inscription réussie !');
      } catch (error) {
        alert('Erreur : ' + error.message);
      }
    });
  }

  // Connexion
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(loginForm);
      const email = formData.get('email');
      const password = formData.get('password');
      try {
        const user = await loginArtisan(email, password);
        saveSession(user);
        showDashboard();
        alert('Connexion réussie !');
      } catch (error) {
        alert('Erreur : ' + error.message);
      }
    });
  }

  // Déconnexion
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      clearSession();
      showLogin();
    });
  }

  // Fonctions d'affichage
  function showDashboard() {
    loginSection.classList.add('hidden');
    registerSection.classList.add('hidden');
    dashboardSection.classList.remove('hidden');
    // Charger les leads
    loadLeads();
  }

  function showLogin() {
    loginSection.classList.remove('hidden');
    registerSection.classList.add('hidden');
    dashboardSection.classList.add('hidden');
    // Réinitialiser les formulaires
    if (loginForm) loginForm.reset();
    if (registerForm) registerForm.reset();
  }

  async function loadLeads() {
    if (!leadsContainer) return;
    leadsContainer.innerHTML = '<p>Chargement des leads...</p>';
    try {
      const leads = await fetchAvailableLeads();
      if (!leads || leads.length === 0) {
        leadsContainer.innerHTML = '<p>Aucun lead disponible pour le moment.</p>';
        return;
      }
      renderLeads(leads);
    } catch (error) {
      leadsContainer.innerHTML = `<p>Erreur : ${error.message}</p>`;
    }
  }

  function renderLeads(leads) {
    leadsContainer.innerHTML = '';
    leads.forEach(lead => {
      const card = document.createElement('div');
      card.className = 'lead-card';
      card.innerHTML = `
        <h4>${lead.titre || 'Chantier'}</h4>
        <p>${lead.description || 'Description non fournie'}</p>
        <p><span class="price">${lead.prix ? lead.prix + ' €' : 'Prix sur demande'}</span></p>
        <p><small>${lead.localisation || 'Localisation non précisée'}</small></p>
        <div class="actions">
          <button class="btn-primary btn-sm" data-lead-id="${lead.id}">Acheter ce lead</button>
        </div>
      `;
      leadsContainer.appendChild(card);

      // Gestion du bouton d'achat
      const buyBtn = card.querySelector('button');
      buyBtn.addEventListener('click', async () => {
        const leadId = buyBtn.dataset.leadId;
        // Montant fixe ou récupéré du lead (en centimes)
        const amount = lead.prix ? lead.prix * 100 : 5000; // 50€ par défaut
        try {
          // Créer le PaymentIntent
          const { clientSecret } = await createPaymentIntent(leadId, amount);
          // Stripe checkout
          const stripe = Stripe(STRIPE_PUBLISHABLE_KEY);
          const { error } = await stripe.confirmPayment({
            clientSecret,
            confirmParams: {
              return_url: window.location.href + '?payment_success=true',
            },
          });
          if (error) {
            alert('Erreur de paiement : ' + error.message);
          } else {
            // Le paiement est confirmé (redirection)
            // On peut afficher un message ou recharger
            alert('Paiement réussi ! Le lead vous sera attribué.');
            loadLeads(); // rafraîchir la liste
          }
        } catch (error) {
          alert('Erreur : ' + error.message);
        }
      });
    });
  }

  // Vérifier si l'utilisateur est déjà connecté
  if (currentUser) {
    showDashboard();
  } else {
    showLogin();
  }
}

// ===== Initialisation selon la page =====
document.addEventListener('DOMContentLoaded', () => {
  // Déterminer quelle page
  const path = window.location.pathname;
  if (path.includes('client.html')) {
    initClientPage();
  } else if (path.includes('artisan.html')) {
    initArtisanPage();
  }
  // index.html : pas d'init particulière
});