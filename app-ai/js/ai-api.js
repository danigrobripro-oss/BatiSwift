/**
 * BâtiSwift AI — ai-api.js
 * Client API centralisé pour l'Espace Privé BâtiSwift AI.
 * S'appuie sur la configuration globale CONFIG si présente, avec fallback automatique.
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
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(options.headers || {}),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, { ...options, headers });
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
        throw error;
      }

      return data;
    } catch (err) {
      console.error(`[AIApi] Erreur sur ${endpoint}:`, err);
      throw err;
    }
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
};

