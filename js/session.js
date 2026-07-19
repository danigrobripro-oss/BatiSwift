/**
 * BâtiSwift — session.js
 * Auth Guard JWT complet.
 * Charge après config.js et api.js.
 */

const Session = {

  getToken()  { return localStorage.getItem(CONFIG.TOKEN_KEY) || null; },
  getUser()   { try { return JSON.parse(localStorage.getItem(CONFIG.USER_KEY) || 'null'); } catch { return null; } },

  save(token, artisan) {
    localStorage.setItem(CONFIG.TOKEN_KEY, token);
    localStorage.setItem(CONFIG.USER_KEY, JSON.stringify(artisan));
  },

  clear() {
    localStorage.removeItem(CONFIG.TOKEN_KEY);
    localStorage.removeItem(CONFIG.USER_KEY);
  },

  /** Vérifie le token côté client (sans réseau) */
  isLoggedIn() {
    const token = this.getToken();
    if (!token) return false;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp * 1000 > Date.now();
    } catch { return false; }
  },

  /** Vérifie le token côté serveur (avec réseau) */
  async verify() {
    if (!this.getToken()) return null;
    try {
      const data = await API.me();
      if (data.artisan) {
        localStorage.setItem(CONFIG.USER_KEY, JSON.stringify(data.artisan));
        return data.artisan;
      }
      this.clear(); return null;
    } catch { this.clear(); return null; }
  },

  /** PAGE PRIVÉE — redirige vers connexion si non connecté */
  async requireAuth() {
    if (!this.isLoggedIn()) {
      window.location.href = '/connexion.html?redirect=' + encodeURIComponent(window.location.pathname);
      return null;
    }
    const user = await this.verify();
    if (!user) return null;   // verify() gère déjà la redirection si 401
    return user;
  },

  /** PAGE PUBLIQUE AUTH — redirige vers dashboard si déjà connecté */
  async redirectIfAuth(to = '/dashboard.html') {
    if (this.isLoggedIn()) { window.location.href = to; return true; }
    return false;
  },

  logout() { this.clear(); window.location.href = '/index.html'; },

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