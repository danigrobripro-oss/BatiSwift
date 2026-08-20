/**
 * BâtiSwift — session.js
 * Gestion JWT. Chargé après config.js et api.js.
 */

var Session = {

  getToken: function() {
    return localStorage.getItem(CONFIG.TOKEN_KEY) || null;
  },

  getUser: function() {
    try { return JSON.parse(localStorage.getItem(CONFIG.USER_KEY) || 'null'); }
    catch(e) { return null; }
  },

  getRole: function() {
    var user = this.getUser();
    return user && user.role ? user.role : null;
  },

  save: function(token, artisan) {
    localStorage.setItem(CONFIG.TOKEN_KEY, token);
    localStorage.setItem(CONFIG.USER_KEY, JSON.stringify(artisan));
  },

  clear: function() {
    localStorage.removeItem(CONFIG.TOKEN_KEY);
    localStorage.removeItem(CONFIG.USER_KEY);
  },

  isLoggedIn: function() {
    var token = this.getToken();
    if (!token) return false;
    try {
      var payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp * 1000 > Date.now();
    } catch(e) { return false; }
  },

  verify: async function() {
    if (!this.getToken()) return null;
    try {
      var data = await API.me();
      if (data && data.artisan) {
        localStorage.setItem(CONFIG.USER_KEY, JSON.stringify(data.artisan));
        return data.artisan;
      }
      this.clear(); return null;
    } catch(e) { this.clear(); return null; }
  },

  /** Pages privées : redirige vers connexion si non connecté */
  requireAuth: async function() {
    if (!this.isLoggedIn()) {
      window.location.href = '/connexion.html?redirect=' + encodeURIComponent(window.location.pathname);
      return null;
    }
    var user = await this.verify();
    if (!user) return null;
    return user;
  },

  /**
   * Pages auth : redirige selon le rôle.
   * - Si un paramètre `to` est fourni, il est prioritaire.
   * - Sinon, artisan → /dashboard.html, client → /client.html
   */
  redirectIfAuth: async function(to) {
    if (this.isLoggedIn()) {
      var user = await this.verify();
      if (!user) return false;

      var target = to;
      if (!target) {
        if (user.role === 'client') {
          target = '/client.html';
        } else {
          target = '/dashboard.html';
        }
      }
      window.location.href = target;
      return true;
    }
    return false;
  },

  logout: function() {
    this.clear();
    window.location.href = '/index.html';
  },

  /**
   * Met à jour la nav après injection du header.
   * Connecté  → masque .nav-guest, affiche .nav-user + prénom
   * Invité    → affiche .nav-guest, masque .nav-user
   */
  updateNav: function() {
    var user   = this.getUser();
    var isAuth = this.isLoggedIn() && !!user;

    document.querySelectorAll('.nav-guest').forEach(function(el) {
      el.style.display = isAuth ? 'none' : '';
    });
    document.querySelectorAll('.nav-user').forEach(function(el) {
      el.style.display = isAuth ? 'flex' : 'none';
    });

    if (isAuth && user) {
      var g = document.getElementById('nav-user-greeting');
      if (g) g.textContent = (user.nom || '').split(' ')[0];
    }

    // Boutons logout
    document.querySelectorAll('[data-action="logout"]').forEach(function(btn) {
      btn.addEventListener('click', function() { Session.logout(); });
    });

    // Adaptation du lien dashboard selon le rôle
    var dashLink = document.getElementById('nav-dashboard-link');
    if (dashLink && user) {
      dashLink.href = (user.role === 'client') ? '/client.html' : '/dashboard.html';
    }
  }
};

// Met à jour la nav dès que le header est injecté
document.addEventListener('header:loaded', function() { Session.updateNav(); });