/**
 * BâtiSwift — main.js
 * Injection header/footer + animations + helpers globaux.
 * Chargé en 3ème (après session.js).
 */

// ─── INJECTION HEADER / FOOTER ──────────────────────────────
async function loadComponent(containerId, filePath) {
  const container = document.getElementById(containerId);
  if (!container) return;
  try {
    const resp = await fetch(filePath);
    if (!resp.ok) return;
    container.innerHTML = await resp.text();
    // Exécute les scripts inline si présents
    container.querySelectorAll('script').forEach(old => {
      const s = document.createElement('script');
      s.textContent = old.textContent;
      old.parentNode.replaceChild(s, old);
    });
  } catch (e) {
    console.warn(`[main.js] Impossible de charger ${filePath}:`, e);
  }
}

async function initLayout() {
  const isMinimal = document.body.classList.contains('minimal-layout');
  const headerFile = isMinimal ? '/header-minimal.html' : '/header.html';
  const footerFile = isMinimal ? '/footer-minimal.html' : '/footer.html';

  await loadComponent('header-container', headerFile);
  document.dispatchEvent(new Event('header:loaded'));   // signal pour session.js
  Session.updateNav();
  highlightActiveNav();

  await loadComponent('footer-container', footerFile);
}

/** Marque le lien nav actif selon l'URL courante */
function highlightActiveNav() {
  const current = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-link[href]').forEach(a => {
    a.classList.toggle('active', a.getAttribute('href') === current);
  });
}

// ─── SCROLL REVEAL ──────────────────────────────────────────
function initReveal() {
  const els = document.querySelectorAll('.reveal');
  if (!els.length) return;
  const obs = new IntersectionObserver((entries) => {
    entries.forEach((e, i) => {
      if (e.isIntersecting) {
        setTimeout(() => e.target.classList.add('visible'), i * 80);
        obs.unobserve(e.target);
      }
    });
  }, { threshold: 0.12 });
  els.forEach(el => obs.observe(el));
}

// ─── ALERTS ─────────────────────────────────────────────────
/**
 * Affiche un message dans un élément alert.
 * @param {string} id      - id de l'élément .alert
 * @param {string} message
 * @param {'success'|'danger'|'warning'|'info'} type
 */
function showAlert(id, message, type = 'danger') {
  const el = document.getElementById(id);
  if (!el) return;
  el.className = `alert alert-${type}`;
  el.textContent = message;
  el.style.display = 'flex';
  if (type === 'success') setTimeout(() => el.style.display = 'none', 5000);
}

function hideAlert(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = 'none';
}

// ─── BOUTON LOADER ──────────────────────────────────────────
function btnLoading(btn, loading = true, originalText) {
  if (loading) {
    btn._originalText = btn.innerHTML;
    btn.innerHTML = '<span class="spinner"></span>';
    btn.disabled = true;
  } else {
    btn.innerHTML = btn._originalText || originalText || 'Envoyer';
    btn.disabled = false;
  }
}

// ─── TOAST NOTIFICATION ─────────────────────────────────────
function toast(message, type = 'success', duration = 3500) {
  const colors = { success: '#10B981', danger: '#EF4444', warning: '#F59E0B', info: '#2B2B2B' };
  const t = document.createElement('div');
  t.style.cssText = `
    position:fixed;bottom:24px;right:24px;z-index:9999;
    background:${colors[type] || colors.info};color:#fff;
    padding:13px 22px;border-radius:12px;font-size:.9rem;font-weight:500;
    box-shadow:0 8px 32px rgba(0,0,0,.2);
    animation:fadeIn .3s ease both;max-width:340px;
  `;
  t.textContent = message;
  document.body.appendChild(t);
  setTimeout(() => { t.style.opacity='0'; t.style.transform='translateY(10px)'; t.style.transition='all .3s'; setTimeout(() => t.remove(), 300); }, duration);
}

// ─── STATS LIVE ─────────────────────────────────────────────
async function loadStats() {
  const containers = document.querySelectorAll('[data-stat]');
  if (!containers.length) return;
  try {
    const data = await API.get('/api/stats');
    containers.forEach(el => {
      const key = el.dataset.stat;
      if (data[key] !== undefined) el.textContent = data[key];
    });
  } catch { /* stats non critiques */ }
}

// ─── MODAL ──────────────────────────────────────────────────
function openModal(id) {
  const m = document.getElementById(id);
  if (m) { m.classList.add('open'); document.body.style.overflow = 'hidden'; }
}
function closeModal(id) {
  const m = document.getElementById(id);
  if (m) { m.classList.remove('open'); document.body.style.overflow = ''; }
}
// Fermeture en cliquant sur le fond
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('open'); document.body.style.overflow = '';
  }
});

// ─── PAGE LOADER ────────────────────────────────────────────
function hidePageLoader() {
  const loader = document.getElementById('page-loader');
  if (loader) { loader.classList.add('hidden'); setTimeout(() => loader.remove(), 400); }
}

// ─── INIT ────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await initLayout();
  initReveal();
  await loadStats();
  hidePageLoader();
});