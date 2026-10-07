/**
 * BâtiSwift — session.js v2.1
 * Gestion JWT, Rôles et Contexte (Artisan / Client).
 * Chargé après config.js et api.js.
 *
 * RÈGLES DE SÉCURITÉ :
 * - getContext() retourne TOUJOURS le rôle réel si l'utilisateur est artisan ou client.
 * - Seul un compte MIXTE peut avoir un contexte sauvegardé différent.
 * - Un changement manuel de localStorage.batiswift_context ne peut pas élever les droits.
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

  // ─── GESTION DU CONTEXTE ACTIF (Artisan / Client) ─────────────────────────
  // IMPORTANT : pour les rôles "artisan" et "client", le contexte est FIXE.
  // Seul le rôle "mixte" peut changer de contexte via switchContext().
  // Un changement manuel de localStorage ne peut pas bypasser cette vérification.
  getContext: function() {
    var user = this.getUser();
    if (!user) return 'artisan'; // défaut visiteur

    // Rôle fixe : le contexte est toujours déterminé par le rôle JWT
    if (user.role === 'artisan') return 'artisan';
    if (user.role === 'client') return 'client';

    // Seulement pour 'mixte' : lire le contexte sauvegardé
    if (user.role === 'mixte') {
      var saved = localStorage.getItem(CONFIG.CONTEXT_KEY);
      if (saved === 'artisan' || saved === 'client') return saved;
      return 'artisan'; // défaut mixte
    }

    return 'artisan'; // sécurité finale
  },

  setContext: function(ctx) {
    if (ctx !== 'artisan' && ctx !== 'client') return;
    // On ne sauvegarde dans localStorage que pour les mixtes
    // Pour les autres rôles, le contexte est déterminé par getContext() dynamiquement
    var user = this.getUser();
    if (user && user.role === 'mixte') {
      localStorage.setItem(CONFIG.CONTEXT_KEY, ctx);
    }
    document.dispatchEvent(new CustomEvent('context:changed', { detail: { context: ctx } }));
    this.updateNav();
  },

  // Bascule uniquement disponible pour les comptes mixtes
  switchContext: function() {
    var user = this.getUser();
    if (!user || user.role !== 'mixte') {
      console.warn('BatiSwift: switchContext() ignoré — compte non mixte.');
      return;
    }
    var current = this.getContext();
    var next = (current === 'artisan') ? 'client' : 'artisan';
    localStorage.setItem(CONFIG.CONTEXT_KEY, next);
    document.dispatchEvent(new CustomEvent('context:changed', { detail: { context: next } }));
    var path = window.location.pathname;
    if (next === 'client' && (path.includes('dashboard') && !path.includes('client-dashboard') || path.includes('marketplace') || path.includes('achats') || path.includes('stripe'))) {
      window.location.href = '/client-dashboard.html';
    } else if (next === 'artisan' && path.includes('client-dashboard')) {
      window.location.href = '/dashboard.html';
    } else {
      this.updateNav();
      window.location.reload();
    }
  },

  save: function(token, artisan) {
    localStorage.setItem(CONFIG.TOKEN_KEY, token);
    localStorage.setItem(CONFIG.USER_KEY, JSON.stringify(artisan));
    // Nettoyer le contexte sauvegardé si ce n'est pas un compte mixte
    if (artisan && artisan.role !== 'mixte') {
      localStorage.removeItem(CONFIG.CONTEXT_KEY);
    }
  },

  clear: function() {
    localStorage.removeItem(CONFIG.TOKEN_KEY);
    localStorage.removeItem(CONFIG.USER_KEY);
    localStorage.removeItem(CONFIG.CONTEXT_KEY);
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
        // Nettoyer le contexte si rôle changé côté serveur
        if (data.artisan.role !== 'mixte') {
          localStorage.removeItem(CONFIG.CONTEXT_KEY);
        }
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
   * Vérifie que l'utilisateur a accès à l'espace demandé.
   * La vérification est TOUJOURS faite contre le rôle JWT, jamais contre le localStorage seul.
   *
   * - 'artisan' requis : seuls artisan et mixte passent. Un client est bloqué.
   * - 'client' requis  : seuls client et mixte passent. Un artisan est bloqué.
   */
  requireRole: async function(expectedRole) {
    var user = await this.requireAuth();
    if (!user) return null;

    var role = user.role;

    // Compte mixte : accès aux deux espaces
    if (role === 'mixte') {
      // Forcer le contexte selon la page demandée
      if (user.role === 'mixte') {
        localStorage.setItem(CONFIG.CONTEXT_KEY, expectedRole);
      }
      return user;
    }

    // Accès correct
    if (role === expectedRole) {
      return user;
    }

    // Client tente d'accéder à l'espace artisan → blocage
    if (expectedRole === 'artisan' && role === 'client') {
      window.location.href = '/client-dashboard.html?denied=artisan';
      return null;
    }

    // Artisan tente d'accéder à l'espace client → blocage
    if (expectedRole === 'client' && role === 'artisan') {
      window.location.href = '/dashboard.html?denied=client';
      return null;
    }

    return user;
  },

  /**
   * Pages auth (connexion, inscription) : redirige selon le rôle vers l'espace approprié.
   */
  redirectIfAuth: async function(to) {
    if (this.isLoggedIn()) {
      var user = await this.verify();
      if (!user) return false;

      var target = to;
      if (!target) {
        if (user.role === 'client') {
          target = '/client-dashboard.html';
        } else if (user.role === 'mixte') {
          var ctx = this.getContext();
          target = (ctx === 'client') ? '/client-dashboard.html' : '/dashboard.html';
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
   * Met à jour la navigation selon le contexte et le rôle réel.
   * Le bouton switcher est visible UNIQUEMENT pour les comptes mixtes.
   */
  updateNav: function() {
    var user   = this.getUser();
    var isAuth = this.isLoggedIn() && !!user;
    var ctx    = this.getContext(); // retourne toujours le bon contexte selon le rôle

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
        roleBadge.style.background = (ctx === 'client') ? 'rgba(43,43,43,0.08)' : 'rgba(201,168,76,0.15)';
        roleBadge.style.color = (ctx === 'client') ? '#2B2B2B' : '#7a5b1a';
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

    // Bouton de bascule de contexte — UNIQUEMENT pour les comptes mixtes
    var switcher = document.getElementById('context-switcher');
    if (switcher) {
      var isMixte = isAuth && user && user.role === 'mixte';
      switcher.style.display = isMixte ? 'block' : 'none';
      if (isMixte) {
        var switchText = document.getElementById('context-switcher-text');
        if (switchText) {
          switchText.textContent = (ctx === 'artisan') ? '🏠 Passer en mode Client' : '🛠️ Passer en mode Artisan';
        }
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