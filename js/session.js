// session.js – Gestion de session persistante pour BâtiSwift
const TOKEN_KEY = "batiswift-artisan-token";
const API_BASE = "https://agent-btp.onrender.com";

// ========== GESTION DE SESSION ==========
function getToken() {
    return localStorage.getItem(TOKEN_KEY);
}

function setToken(token) {
    if (token) {
        localStorage.setItem(TOKEN_KEY, token);
    } else {
        localStorage.removeItem(TOKEN_KEY);
    }
}

function isLoggedIn() {
    return !!getToken();
}

function logout() {
    setToken(null);
    window.location.href = 'index.html';
}

// ========== RÉCUPÉRATION DES INFOS UTILISATEUR ==========
async function fetchUserInfo() {
    const token = getToken();
    if (!token) return null;
    try {
        const res = await fetch(`${API_BASE}/api/artisan/me?token=${token}`);
        if (!res.ok) throw new Error('Non autorisé');
        return await res.json();
    } catch (e) {
        console.error('Erreur chargement profil', e);
        setToken(null);
        return null;
    }
}

// ========== MISE À JOUR DE L'INTERFACE ==========
function updateUI(user) {
    const isLoggedIn = !!user;
    
    const loginBtn = document.getElementById('nav-login');
    const registerBtn = document.getElementById('nav-register');
    const logoutBtn = document.getElementById('nav-logout');
    const dashboardBtn = document.getElementById('nav-dashboard');
    const clientBtn = document.getElementById('nav-client');
    const userDisplay = document.getElementById('nav-user');
    const userNameSpan = document.getElementById('user-name-display');

    if (isLoggedIn) {
        if (loginBtn) loginBtn.style.display = 'none';
        if (registerBtn) registerBtn.style.display = 'none';
        if (logoutBtn) logoutBtn.style.display = 'inline';
        if (dashboardBtn) dashboardBtn.style.display = 'inline';
        if (clientBtn) clientBtn.style.display = 'inline';
        if (userDisplay) {
            userDisplay.style.display = 'inline';
            if (userNameSpan) userNameSpan.textContent = user.name || 'Artisan';
        }
    } else {
        if (loginBtn) loginBtn.style.display = 'inline';
        if (registerBtn) registerBtn.style.display = 'inline';
        if (logoutBtn) logoutBtn.style.display = 'none';
        if (dashboardBtn) dashboardBtn.style.display = 'none';
        if (clientBtn) clientBtn.style.display = 'none';
        if (userDisplay) userDisplay.style.display = 'none';
    }
}

// ========== INITIALISATION ==========
async function initSession() {
    const token = getToken();
    if (!token) {
        updateUI(null);
        return;
    }
    const user = await fetchUserInfo();
    updateUI(user);
}

// Exposer les fonctions globalement
window.initSession = initSession;
window.logout = logout;
window.updateUI = updateUI;
window.getToken = getToken;