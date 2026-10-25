/**
 * BâtiSwift AI — ai-auth.js
 * Gardien de session JWT pour l'Espace Privé BâtiSwift AI.
 * Vérifie l'existence du token avant le rendu de l'interface.
 */

const AIAuth = {
  init() {
    const token = AIApi.getToken();
    if (!token) {
      const currentPath = window.location.pathname;
      window.location.href = `/connexion.html?redirect=${encodeURIComponent(currentPath)}`;
      return false;
    }

    this.renderUserInfo();
    return true;
  },

  getUser() {
    try {
      const raw = localStorage.getItem('batiswift_user') || localStorage.getItem('artisan_user');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  renderUserInfo() {
    const user = this.getUser();
    const nameEl = document.getElementById('ai-artisan-name');
    const avatarEl = document.getElementById('ai-artisan-avatar');

    if (user) {
      const displayName = user.nom_entreprise || user.nom || 'Mon Entreprise';
      if (nameEl) nameEl.textContent = displayName;
      if (avatarEl) {
        avatarEl.textContent = displayName.charAt(0).toUpperCase();
      }
    }
  },

  logout() {
    localStorage.removeItem('batiswift_token');
    localStorage.removeItem('artisan_token');
    localStorage.removeItem('batiswift_user');
    localStorage.removeItem('artisan_user');
    window.location.href = '/connexion.html';
  },
};

// Exécution immédiate au chargement
document.addEventListener('DOMContentLoaded', () => {
  AIAuth.init();
});

