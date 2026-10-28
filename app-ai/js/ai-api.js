/**
 * BâtiSwift AI — ai-api.js
 * Client API centralisé pour l'Espace Privé BâtiSwift AI.
 * S'appuie sur la configuration globale CONFIG si présente, avec fallback automatique.
 *
 * Contrat conservé : getBaseUrl, getToken, request, getModules, getProfile,
 * checkModuleStatus, createCheckoutSession.
 * Ajouts : isPaywall(err), renderError(container, err).
 */

const AIApi = {
  getBaseUrl() {
    if (typeof CONFIG !== 'undefined' && CONFIG.API_URL) {
      return CONFIG.API_URL;
    }
    const host = window.location.hostname;
    return (host === 'localhost' || host === '127.0.0.1')
      ? 'http://localhost:8000'
      : 'https://agent-btp.onrender.com';
  },

  getToken() {
    return localStorage.getItem('batiswift_token') ||
           localStorage.getItem('artisan_token') ||
           null;
  },

  async request(endpoint, options = {}) {
    const url = `${this.getBaseUrl()}${endpoint}`;
    const token = this.getToken();

    const headers = {
      'Accept': 'application/json',
      ...(options.headers || {}),
    };
    // Pour un envoi de fichier (FormData) le navigateur fixe lui-même le Content-Type multipart.
    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    let response;
    try {
      response = await fetch(url, { ...options, headers });
    } catch (netErr) {
      console.error(`[AIApi] Erreur réseau sur ${endpoint}:`, netErr);
      const error = new Error('Impossible de joindre le serveur. Vérifiez votre connexion et réessayez.');
      error.status = 0;
      error.network = true;
      throw error;
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      if (response.status === 401) {
        // Token expiré ou invalide : redirection vers la connexion
        localStorage.removeItem('batiswift_token');
        localStorage.removeItem('artisan_token');
        window.location.href = `/connexion.html?redirect=${encodeURIComponent(window.location.pathname)}&expired=1`;
      }
      const error = new Error(data.error || `Erreur serveur ${response.status}`);
      error.status = response.status;
      error.data = data;
      error.redirecting = response.status === 401;
      console.error(`[AIApi] Erreur ${response.status} sur ${endpoint}:`, error.message);
      throw error;
    }

    return data;
  },

  // Récupérer le catalogue des modules et le statut pour l'artisan connecté
  async getModules() {
    return this.request('/api/ai/modules');
  },

  // Récupérer le résumé du profil IA
  async getProfile() {
    return this.request('/api/ai/me');
  },

  // Vérifier l'accès à un module spécifique
  async checkModuleStatus(moduleId) {
    return this.request(`/api/ai/${moduleId}/status`);
  },

  // Initier une session Stripe Checkout pour un module individuel
  async createCheckoutSession(moduleId) {
    return this.request('/api/ai/checkout-session', {
      method: 'POST',
      body: JSON.stringify({ module_id: moduleId }),
    });
  },

  // Raccourcis pour les routes métier des modules
  get(path) { return this.request(path); },
  post(path, body) { return this.request(path, { method: 'POST', body: JSON.stringify(body || {}) }); },
  put(path, body) { return this.request(path, { method: 'PUT', body: JSON.stringify(body || {}) }); },
  del(path) { return this.request(path, { method: 'DELETE' }); },
  upload(path, formData, method = 'POST') { return this.request(path, { method, body: formData }); },

  /**
   * Vrai uniquement si le SERVEUR a répondu 403 « abonnement requis ».
   * Toute autre erreur (réseau, 500, compte non confirmé...) ne doit PAS afficher le paywall.
   */
  isPaywall(err) {
    return !!(err && err.status === 403 && err.data && err.data.requires_subscription === true);
  },

  /**
   * Affiche une erreur non liée à l'abonnement, sans injecter de HTML (textContent uniquement).
   */
  renderError(container, err) {
    if (!container || (err && err.redirecting)) return;
    container.textContent = '';
    const box = document.createElement('div');
    box.style.cssText = 'background:var(--bs-danger-bg);color:var(--bs-danger);padding:1.5rem;border-radius:12px;border:1px solid var(--bs-danger);';
    const msg = document.createElement('p');
    msg.style.marginBottom = '1rem';
    msg.textContent = (err && err.message) || 'Une erreur est survenue.';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = 'Réessayer';
    btn.style.cssText = 'padding:0.5rem 1.25rem;border-radius:8px;border:1px solid currentColor;background:transparent;color:inherit;font-weight:600;cursor:pointer;';
    btn.addEventListener('click', () => window.location.reload());
    box.appendChild(msg);
    box.appendChild(btn);
    container.appendChild(box);
  },
};

