/**
 * BâtiSwift — session.js
 * Gestion JWT : stockage, lecture, protection des pages.
 * Chargé en 2ème (après config.js).
 */

const Session = {

  /** Retourne le token brut ou null */
  getToken() {
    return localStorage.getItem(CONFIG.TOKEN_KEY) || null;
  },

  /** Sauvegarde token + données user */
  save(token, artisan) {
    localStorage.setItem(CONFIG.TOKEN_KEY, token);
    localStorage.setItem(CONFIG.USER_KEY, JSON.stringify(artisan));
  },

  /** Supprime la session */
  clear() {
    localStorage.removeItem(CONFIG.TOKEN_KEY);
    localStorage.removeItem(CONFIG.USER_KEY);
  },

  /** Retourne les données user depuis le cache (pas de requête) */
  getUser() {
    try   { return JSON.parse(localStorage.getItem(CONFIG.USER_KEY) || 'null'); }
    catch { return null; }
  },

  /** Vérifie si un token existe (sans appel réseau) */
  isLoggedIn() {
    const token = this.getToken();
    if (!token) return false;
    // Vérifie la date d'expiration côté client
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp * 1000 > Date.now();
    } catch {
      return false;
    }
  },

  /**
   * Vérifie l'authentification côté serveur.
   * @returns {object|null} artisan ou null
   */
  async verify() {
    if (!this.getToken()) return null;
    try {
      const data = await API.get('/api/me');
      if (data.artisan) {
        localStorage.setItem(CONFIG.USER_KEY, JSON.stringify(data.artisan));
        return data.artisan;
      }
      return null;
    } catch {
      this.clear();
      return null;
    }
  },

  /**
   * Redirige vers connexion.html si non connecté.
   * Utilisé sur toutes les pages privées.
   */
  async requireAuth(redirect = '/connexion.html') {
    const user = await this.verify();
    if (!user) {
      window.location.href = redirect + '?redirect=' + encodeURIComponent(window.location.pathname);
      return null;
    }
    return user;
  },

  /**
   * Redirige vers dashboard si déjà connecté.
   * Utilisé sur connexion.html / inscription.html.
   */
  async redirectIfAuth(redirect = '/dashboard.html') {
    if (this.isLoggedIn()) {
      window.location.href = redirect;
      return true;
    }
    return false;
  },

  /** Déconnexion propre */
  logout() {
    this.clear();
    window.location.href = '/index.html';
  },

  /** Met à jour l'interface de navigation */
  updateNav() {
    const user    = this.getUser();
    const isAuth  = this.isLoggedIn() && !!user;

    // Éléments "invité"
    document.querySelectorAll('.nav-guest').forEach(el => {
      el.style.display = isAuth ? 'none' : '';
    });
    // Éléments "connecté"
    document.querySelectorAll('.nav-user').forEach(el => {
      el.style.display = isAuth ? '' : 'none';
    });
    // Prénom dans le header
    const greet = document.getElementById('nav-user-greeting');
    if (greet && user) greet.textContent = `Bonjour, ${user.nom.split(' ')[0]}`;

    // Bouton logout
    document.querySelectorAll('[data-action="logout"]').forEach(btn => {
      btn.addEventListener('click', () => Session.logout());
    });
  }
};

// Auto-update nav après injection du header
document.addEventListener('header:loaded', () => Session.updateNav());