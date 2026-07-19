/**
 * BâtiSwift — config.js
 * Configuration globale + API + Utilitaires.
 * Chargé en PREMIER sur toutes les pages.
 * Utilise les cookies de session Flask (pas de JWT).
 */

const CONFIG = {
  // URL du backend (auto-détection locale / production)
  API_URL: (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:8000'
    : 'https://VOTRE-BACKEND.onrender.com',   // ← à changer en production

  STRIPE_PK: 'pk_test_VOTRE_CLE_STRIPE_ICI',  // ← votre clé publique Stripe (test)
  VERSION:   '2.0.0',
  TOKEN_KEY: 'batiswift_token',
  USER_KEY:  'batiswift_user',
};

const API_BASE = CONFIG.API_URL;   // pour compatibilité avec l'existant
const STRIPE_PUBLISHABLE_KEY = CONFIG.STRIPE_PK;

// ─── Appel API centralisé (cookie de session) ──────────────────
async function api(endpoint, options = {}) {
const url = CONFIG.API_URL + endpoint;
const headers = { 'Content-Type': 'application/json' };
if (options.headers) Object.assign(headers, options.headers);

let response;
try {
  response = await fetch(url, {
    credentials: 'include',   // indispensable pour le cookie de session Flask
    headers,
    ...options
  });
} catch {
  throw new Error('Impossible de contacter le serveur. Vérifiez votre connexion.');
}

let data;
try   { data = await response.json(); }
catch { data = {}; }

if (!response.ok) {
  const msg = data.error || data.message || `Erreur serveur (${response.status})`;
  throw new Error(msg);
}

return data;
}

// ─── Méthodes API spécifiques (utilisées par les pages) ──────
const API = {
// Auth
login:           (email, password) => api('/api/artisan/login',    { method: 'POST', body: JSON.stringify({ email, password }) }),
register:        (body)            => api('/api/artisan/register', { method: 'POST', body: JSON.stringify(body) }),
me:              ()                => api('/api/me'),
updateProfile:   (body)            => api('/api/artisan/profile',  { method: 'PUT',  body: JSON.stringify(body) }),
logout:          ()                => api('/api/artisan/logout',   { method: 'POST' }),

// Leads
leadsAvailable:  ()                => api('/api/leads/available'),
artisanLeads:    ()                => api('/api/artisan/leads'),
addTag:          (lead_id, tag)    => api(`/api/leads/${lead_id}/tag`, { method: 'POST', body: JSON.stringify({ tag }) }),

// Paiement
createPaymentIntent: (lead_id)     => api('/api/create-payment-intent', { method: 'POST', body: JSON.stringify({ lead_id }) }),

// FAQ
faq:             (question)        => api('/api/faq', { method: 'POST', body: JSON.stringify({ question }) }),

// Stats publiques
stats:           ()                => api('/api/stats'),

// Raccourcis génériques (optionnel, conservé pour compatibilité)
get:    (ep)             => api(ep, { method: 'GET' }),
post:   (ep, body)       => api(ep, { method: 'POST',   body: JSON.stringify(body) }),
put:    (ep, body)       => api(ep, { method: 'PUT',    body: JSON.stringify(body) }),
delete: (ep)             => api(ep, { method: 'DELETE' }),
};

// ─── Utilitaires (inchangés) ──────────────────────────────────
function fmtDate(iso) {
if (!iso) return '—';
return new Date(iso).toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'numeric' });
}

function capitalize(str) {
return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
}

const TRAVAUX_EMOJI = {
plomberie: '🔧', electricite: '⚡', peinture: '🎨',
maconnerie: '🧱', chauffage: '🔥', serrurerie: '🔐', autre: '🏗️'
};

const URGENCE_LABEL = {
immediate: { label: 'Urgent', class: 'urgence-immediate' },
normale:   { label: 'Normal', class: 'urgence-normale'   },
faible:    { label: 'Faible', class: 'urgence-faible'    },
};