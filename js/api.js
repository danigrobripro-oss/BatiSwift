/**
 * BâtiSwift — api.js
 * Couche réseau centralisée.
 * Chargé EN SECOND, après config.js.
 */

// ─── FETCH DE BASE ───────────────────────────────────────────
async function apiFetch(endpoint, options = {}, _retry = true) {
  const token = localStorage.getItem(CONFIG.TOKEN_KEY);
  const url   = CONFIG.API_URL + endpoint;

  const headers = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  if (options.headers) Object.assign(headers, options.headers);

  // Timeout 60s (Render free tier peut mettre 30-60s à réveiller le service)
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60000);

  let res;
  try {
    res = await fetch(url, { ...options, headers, signal: controller.signal });
  } catch (e) {
    clearTimeout(timer);
    // Si première tentative et erreur réseau → retry unique après 3s
    if (_retry) {
      await new Promise(r => setTimeout(r, 3000));
      return apiFetch(endpoint, options, false);
    }
    if (e.name === 'AbortError') {
      throw new Error('Le serveur met trop de temps à répondre. Réessayez dans un instant.');
    }
    throw new Error('Connexion au serveur impossible. Vérifiez votre réseau ou réessayez dans un instant.');
  } finally {
    clearTimeout(timer);
  }

  let data = {};
  try { data = await res.json(); } catch {}

  if (!res.ok) {
    // Token expiré → déconnexion automatique
    if (res.status === 401) {
      localStorage.removeItem(CONFIG.TOKEN_KEY);
      localStorage.removeItem(CONFIG.USER_KEY);
      if (!window.location.pathname.includes('connexion')) {
        window.location.href = '/connexion.html?expired=1';
      }
    }
    throw new Error(data.error || ('Erreur serveur ' + res.status));
  }

  return data;
}

// ─── OBJET API — tous les endpoints du backend ───────────────
const API = {

  // ─── Méthodes génériques (GET, POST, PUT, DELETE) ──────────
  get: function(endpoint, options) {
    return apiFetch(endpoint, Object.assign({ method: 'GET' }, options || {}));
  },

  post: function(endpoint, body, options) {
    return apiFetch(endpoint, Object.assign({
      method: 'POST',
      body: JSON.stringify(body)
    }, options || {}));
  },

  put: function(endpoint, body, options) {
    return apiFetch(endpoint, Object.assign({
      method: 'PUT',
      body: JSON.stringify(body)
    }, options || {}));
  },

  delete: function(endpoint, options) {
    return apiFetch(endpoint, Object.assign({ method: 'DELETE' }, options || {}));
  },

  // Auth
  register: function(body) {
    return apiFetch('/api/artisan/register', { method: 'POST', body: JSON.stringify(body) });
  },
  login: function(email, password) {
    return apiFetch('/api/artisan/login', { method: 'POST', body: JSON.stringify({ email: email, password: password }) });
  },
  me: function() {
    return apiFetch('/api/me');
  },
  logout: function() {
    return apiFetch('/api/artisan/logout', { method: 'POST' });
  },
  updateProfile: function(body) {
    return apiFetch('/api/artisan/profile', {
      method: 'PUT',
      body: JSON.stringify(body)
    });
  },
  
  updateNotifs: function(body) {
    return apiFetch('/api/artisan/notifications', {
      method: 'PUT',
      body: JSON.stringify(body)
    });
  },
  
  updateSettings: function(body) {
    return apiFetch('/api/artisan/settings', {
      method: 'PUT',
      body: JSON.stringify(body)
    });
  },

  // ─── Agent IA (CORRIGÉ : utilise /api/client/request) ──────
  ask: function(message, historique, extras) {
    // On mappe 'message' → 'description' pour la route /api/client/request
    var body = Object.assign({ description: message, historique: historique || [] }, extras || {});
    return apiFetch('/api/client/request', { method: 'POST', body: JSON.stringify(body) });
  },

  // Leads
  leadsAvailable: function() {
    return apiFetch('/api/leads/available');
  },
  artisanLeads: function() {
    return apiFetch('/api/artisan/leads');
  },
  addTag: function(leadId, tag) {
    return apiFetch('/api/leads/' + leadId + '/tag', { method: 'POST', body: JSON.stringify({ tag: tag }) });
  },
  feedback: function(leadId, body) {
    return apiFetch('/api/leads/' + leadId + '/feedback', { method: 'POST', body: JSON.stringify(body) });
  },
  getQuote: function(leadId) {
    return apiFetch('/api/leads/' + leadId + '/quote');
  },
  relance: function(leadId, message) {
    return apiFetch('/api/leads/' + leadId + '/relance', { method: 'POST', body: JSON.stringify({ message: message || '' }) });
  },
  history: function(leadId) {
    return apiFetch('/api/leads/' + leadId + '/history');
  },

  // Stats & dashboard
  stats: function() {
    return apiFetch('/api/stats');
  },
  dashboardStats: function() {
    return apiFetch('/api/artisan/dashboard-stats');
  },

    // Paiement
    createPaymentIntent: function(leadId) {
      return apiFetch('/api/create-payment-intent', { method: 'POST', body: JSON.stringify({ lead_id: leadId }) });
    },
  
    // Stripe Connect
    stripeStatus: function() {
      return apiFetch('/api/artisan/stripe/status');
    },
    stripeConnect: function() {
      return apiFetch('/api/artisan/stripe/connect', { method: 'POST' });
    },
  };