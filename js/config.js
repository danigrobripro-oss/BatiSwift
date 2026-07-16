/**
 * BâtiSwift — config.js
 * Configuration globale et helper API.
 * Chargé en PREMIER sur toutes les pages.
 */

const CONFIG = {
    // ─── URL du backend ───────────────────────────────────────
    // Dev: http://localhost:8000 | Prod: https://votre-backend.onrender.com
    API_URL: (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
      ? 'http://localhost:8000'
      : 'https://VOTRE-BACKEND.onrender.com',   // ← Remplacez en production
  
    STRIPE_PK: 'pk_test_VOTRE_CLE_STRIPE_ICI',  // ← Remplacez
    VERSION:   '2.0.0',
    TOKEN_KEY: 'batiswift_token',
    USER_KEY:  'batiswift_user',
  };
  
  /**
   * Appel API centralisé.
   * Gère automatiquement le token JWT et les erreurs réseau.
   *
   * @param {string} endpoint   - ex: '/api/artisan/login'
   * @param {object} options    - options fetch standard
   * @returns {Promise<object>} - JSON parsé
   * @throws {Error}            - message d'erreur lisible
   */
  async function api(endpoint, options = {}) {
    const token = localStorage.getItem(CONFIG.TOKEN_KEY);
    const url   = CONFIG.API_URL + endpoint;
  
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (options.headers) Object.assign(headers, options.headers);
  
    let response;
    try {
      response = await fetch(url, { ...options, headers });
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
  
  /** Raccourcis pratiques */
  const API = {
    get:    (ep)             => api(ep, { method: 'GET' }),
    post:   (ep, body)       => api(ep, { method: 'POST',   body: JSON.stringify(body)  }),
    put:    (ep, body)       => api(ep, { method: 'PUT',    body: JSON.stringify(body)  }),
    delete: (ep)             => api(ep, { method: 'DELETE' }),
  };
  
  /** Formate une date ISO en français */
  function fmtDate(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'numeric' });
  }
  
  /** Capitalise la première lettre */
  function capitalize(str) {
    return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
  }
  
  /** Emoji par type de travaux */
  const TRAVAUX_EMOJI = {
    plomberie: '🔧', electricite: '⚡', peinture: '🎨',
    maconnerie: '🧱', chauffage: '🔥', serrurerie: '🔐', autre: '🏗️'
  };
  
  /** Label urgence */
  const URGENCE_LABEL = {
    immediate: { label: 'Urgent', class: 'urgence-immediate' },
    normale:   { label: 'Normal', class: 'urgence-normale'   },
    faible:    { label: 'Faible', class: 'urgence-faible'    },
  };