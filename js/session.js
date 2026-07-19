/**
 * BâtiSwift — session.js
 * Auth Guard via cookie de session Flask (pas de JWT).
 * Interface identique à la version JWT de Claude pour compatibilité.
 * Charge après config.js et api.js.
 */

const Session = {

  /** Vérifie la session via /api/me (cookie) */
  async verify() {
    try {
      const data = await API.me();
      if (data.authenticated && data.artisan) {
        localStorage.setItem(CONFIG.USER_KEY, JSON.stringify(data.artisan));
        return data.artisan;
      }
      this.clear();
      return null;
    } catch {
      this.clear();
      return null;
    }
  },

  /** Vérifie si l'utilisateur est connecté (basé sur la dernière vérification) */
  isLoggedIn() {
    const user = this.getUser();
    return !!user;
  },

  /** Récupère l'utilisateur stocké localement (issu du dernier /api/me) */
  getUser() {
    try {
      return JSON.parse(localStorage.getItem(CONFIG.USER_KEY) || 'null');
    } catch {
      return null;
    }
  },

  /** Sauvegarde l'utilisateur localement (ignore le token JWT inexistant) */
  save(token, artisan) {
    // Le backend Flask ne renvoie pas de token JWT, on ignore le premier argument
    localStorage.setItem(CONFIG.USER_KEY, JSON.stringify(artisan));
  },

  /** Efface toutes les données de session */
  clear() {
    localStorage.removeItem(CONFIG.TOKEN_KEY);
    localStorage.removeItem(CONFIG.USER_KEY);
  },

  /** PAGE PRIVÉE — redirige vers connexion si non connecté */
  async requireAuth() {
    const user = await this.verify();
    if (!user) {
      window.location.href = '/connexion.html?redirect=' + encodeURIComponent(window.location.pathname);
      return null;
    }
    return user;
  },

  /** PAGE PUBLIQUE AUTH — redirige vers dashboard si déjà connecté */
  async redirectIfAuth(to = '/dashboard.html') {
    const user = await this.verify();
    if (user) {
      window.location.href = to;
      return true;
    }
    return false;
  },

  /** Déconnexion : appelle l'API pour supprimer le cookie, puis nettoie le localStorage */
  async logout() {
    try {
      await API.logout();   // POST /api/artisan/logout
    } catch (e) { /* ignore */ }
    this.clear();
    window.location.href = '/index.html';
  },

  /**
   * Met à jour le header dynamiquement.
   * Connecté  → masque .nav-guest, affiche .nav-user + prénom + Paramètres/Déconnexion
   * Invité    → affiche .nav-guest, masque .nav-user
   */
  updateNav() {
    const user   = this.getUser();
    const isAuth = this.isLoggedIn() && !!user;

    document.querySelectorAll('.nav-guest').forEach(el => (el.style.display = isAuth ? 'none' : ''));
    document.querySelectorAll('.nav-user').forEach(el  => (el.style.display = isAuth ? 'flex' : 'none'));

    if (isAuth && user) {
      const g = document.getElementById('nav-user-greeting');
      if (g) g.textContent = user.nom?.split(' ')[0] || '';
    }

    // Boutons logout
    document.querySelectorAll('[data-action="logout"]').forEach(btn =>
      btn.addEventListener('click', () => this.logout())
    );
  }
};

document.addEventListener('header:loaded', () => Session.updateNav());