// BâtiSwift — Gestion de l'authentification et des sessions

let currentUser = null;

async function checkSession() {
  try {
    const res = await fetch(`${API_BASE}/api/me`, { credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      if (data.authenticated && data.artisan) {
        currentUser = data.artisan;
        return currentUser;
      }
    }
  } catch (e) { /* ignore */ }
  currentUser = null;
  return null;
}

function isLoggedIn() {
  return currentUser !== null;
}

/**
 * Redirige vers la page de connexion si l'utilisateur n'est pas authentifié.
 * À appeler en début de script sur chaque page protégée.
 */
async function requireAuth() {
  await checkSession();
  if (!isLoggedIn()) {
    window.location.href = 'connexion.html';
  }
}

async function login(email, password) {
  const res = await fetch(`${API_BASE}/api/artisan/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
    credentials: 'include'
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Erreur de connexion');
  currentUser = data.artisan;
  return data;
}

async function register(formData) {
  const res = await fetch(`${API_BASE}/api/artisan/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(formData),
    credentials: 'include'
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Erreur d\'inscription');
  currentUser = data.artisan;
  return data;
}

async function logout() {
  await fetch(`${API_BASE}/api/artisan/logout`, { method: 'POST', credentials: 'include' });
  currentUser = null;
  window.location.href = 'index.html';
}