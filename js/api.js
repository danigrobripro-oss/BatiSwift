/**
 * BâtiSwift — api.js
 * Couche API dédiée. Charge après config.js.
 * Centralise tous les appels fetch vers le backend.
 */

// ─── HELPER FETCH ────────────────────────────────────────────
async function apiFetch(endpoint, options = {}) {
    const token = localStorage.getItem(CONFIG.TOKEN_KEY);
    const url   = CONFIG.API_URL + endpoint;
  
    const headers = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (options.headers) Object.assign(headers, options.headers);
  
    let res;
    try {
      res = await fetch(url, { ...options, headers });
    } catch {
      throw new Error('Serveur inaccessible. Vérifiez votre connexion ou réessayez.');
    }
  
    const data = await res.json().catch(() => ({}));
  
    if (!res.ok) {
      const msg = data.error || data.message || `Erreur ${res.status}`;
      // Token expiré → déconnexion automatique
      if (res.status === 401) {
        localStorage.removeItem(CONFIG.TOKEN_KEY);
        localStorage.removeItem(CONFIG.USER_KEY);
        if (!window.location.pathname.includes('connexion')) {
          window.location.href = '/connexion.html?expired=1';
        }
      }
      throw new Error(msg);
    }
    return data;
  }
  
  // ─── API NAMESPACED ─────────────────────────────────────────
  const API = {
    // ── Auth ──
    login:    (email, password)   => apiFetch('/api/artisan/login',    { method: 'POST', body: JSON.stringify({ email, password }) }),
    register: (body)              => apiFetch('/api/artisan/register', { method: 'POST', body: JSON.stringify(body) }),
    me:       ()                  => apiFetch('/api/me'),
    updateProfile: (body)         => apiFetch('/api/artisan/profile',  { method: 'PUT',  body: JSON.stringify(body) }),
  
    // ── Agent IA ──
    ask:      (message, historique = [], extras = {}) =>
      apiFetch('/api/ask', { method: 'POST', body: JSON.stringify({ message, historique, ...extras }) }),
  
    // ── Leads ──
    leadsAvailable: ()             => apiFetch('/api/leads/available'),
    artisanLeads:   ()             => apiFetch('/api/artisan/leads'),
    addTag:    (leadId, tag)       => apiFetch(`/api/leads/${leadId}/tag`, { method: 'POST', body: JSON.stringify({ tag }) }),
  
    // ── Stats ──
    stats:     ()                  => apiFetch('/api/stats'),
  
    // ── Stripe ──
    createPaymentIntent: (lead_id) => apiFetch('/api/create-payment-intent', { method: 'POST', body: JSON.stringify({ lead_id }) }),
  
    // ── Admin ──
    adminLeads:    () => apiFetch('/api/admin/leads'),
    adminArtisans: () => apiFetch('/api/admin/artisans'),
  };