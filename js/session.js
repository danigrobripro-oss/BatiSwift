/**
 * BâtiSwift — session.js
 * Gestion JWT, Rôles et Contexte (Artisan / Client).
 * Chargé après config.js et api.js.
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

  // ─── GESTION DU CONTEXTE ACTIF (Artisan / Client) ───────────
  getContext: function() {
    var saved = localStorage.getItem(CONFIG.CONTEXT_KEY);
    if (saved === 'artisan' || saved === 'client') return saved;
    var user = this.getUser();
    if (user && user.role) {
      if (user.role === 'client') return 'client';
      if (user.role === 'artisan') return 'artisan';
      if (user.role === 'mixte') return 'artisan';
    }
    return 'artisan'; // défaut
  },

  setContext: function(ctx) {
    if (ctx !== 'artisan' && ctx !== 'client') return;
    localStorage.setItem(CONFIG.CONTEXT_KEY, ctx);
    document.dispatchEvent(new CustomEvent('context:changed', { detail: { context: ctx } }));
    this.updateNav();
  },

  switchContext: function() {
    var user = this.getUser();
    if (!user || user.role !== 'mixte') {
      return;
    }
    var current = this.getContext();
    var next = (current === 'artisan') ? 'client' : 'artisan';
    this.setContext(next);
    var path = window.location.pathname;
    if (next === 'client' && (path.includes('dashboard') || path.includes('marketplace') || path.includes('achats') || path.includes('stripe'))) {
      window.location.href = '/client-dashboard.html';
    } else if (next === 'artisan' && path.includes('client-dashboard')) {
      window.location.href = '/dashboard.html';
    } else {
      window.location.reload();
    }
  },

  save: function(token, artisan) {
    localStorage.setItem(CONFIG.TOKEN_KEY, token);
    localStorage.setItem(CONFIG.USER_KEY, JSON.stringify(artisan));
    if (artisan && artisan.role) {
      this.setContext(artisan.role === 'client' ? 'client' : 'artisan');
    }
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
   * Vérifie que l'utilisateur a le rôle requis.
   * Si non autorisé, redirige vers l'espace correspondant.
   */
  requireRole: async function(expectedRole) {
    var user = await this.requireAuth();
    if (!user) return null;

    if (user.role === 'mixte') {
      this.setContext(expectedRole);
      return user;
    }

    if (expectedRole === 'artisan' && user.role !== 'artisan') {
      window.location.href = '/client-dashboard.html?denied=artisan';
      return null;
    }

    if (expectedRole === 'client' && user.role !== 'client') {
      window.location.href = '/dashboard.html?denied=client';
      return null;
    }

    this.setContext(expectedRole);
    return user;
  },

  /**
   * Pages auth : redirige selon le rôle vers l'espace approprié.
   */
  redirectIfAuth: async function(to) {
    if (this.isLoggedIn()) {
      var user = await this.verify();
      if (!user) return false;

      var target = to;
      if (!target) {
        if (user.role === 'client' || this.getContext() === 'client') {
          target = '/client-dashboard.html';
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
   * Met à jour la nav après injection du header ou changement de contexte.
   */
  updateNav: function() {
    var user   = this.getUser();
    var isAuth = this.isLoggedIn() && !!user;
    var ctx    = this.getContext();

    // Affichage invité vs connecté
    document.querySelectorAll('.nav-guest, .sidebar-guest').forEach(function(el) {
      el.style.display = isAuth ? 'none' : '';
    });
    document.querySelectorAll('.nav-user, .sidebar-user').forEach(function(el) {
      el.style.display = isAuth ? 'flex' : 'none';
      if (isAuth && el.classList.contains('sidebar-user')) {
        el.style.flexDirection = 'column';
      }
    });

    if (isAuth && user) {
      var g = document.getElementById('nav-user-greeting') || document.getElementById('sidebar-user-nom');
      if (g) g.textContent = (user.nom || '').split(' ')[0] || (ctx === 'client' ? 'Client' : 'Artisan');

      var roleBadge = document.getElementById('sidebar-role-badge');
      if (roleBadge) {
        roleBadge.textContent = (ctx === 'client') ? '🏠 Mode Client' : '🛠️ Mode Artisan';
      }
    }

    // Gestion des liens spécifiques de la nav selon le contexte
    document.querySelectorAll('[data-context-only]').forEach(function(el) {
      var allowed = el.getAttribute('data-context-only');
      if (allowed === ctx || allowed === 'all') {
        el.style.display = '';
      } else {
        el.style.display = 'none';
      }
    });

    // Bouton de bascule de contexte
    var switcher = document.getElementById('context-switcher');
    if (switcher) {
      var isMixed = user && user.role === 'mixte';
      switcher.style.display = (isAuth && isMixed) ? 'block' : 'none';
      var switchText = document.getElementById('context-switcher-text');
      if (switchText) {
        switchText.textContent = (ctx === 'artisan') ? 'Passer en mode Client 🏠' : 'Passer en mode Artisan 🛠️';
      }
    }

    // Boutons logout
    document.querySelectorAll('[data-action="logout"], #sidebar-logout').forEach(function(btn) {
      btn.onclick = function() { Session.logout(); };
    });
  }
};

// Met à jour la nav dès que le header est injecté
document.addEventListener('header:loaded', function() { Session.updateNav(); });