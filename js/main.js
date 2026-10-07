/**
 * BâtiSwift — main.js
 * Injection header/footer + utilitaires globaux.
 * Chargé EN DERNIER, après session.js.
 */

// ─── INJECTION COMPOSANTS ────────────────────────────────────
async function loadComponent(containerId, filePath) {
  var container = document.getElementById(containerId);
  if (!container) return;
  try {
    var resp = await fetch(filePath);
    if (!resp.ok) return;
    container.innerHTML = await resp.text();
    // Exécute les <script> inline du composant
    container.querySelectorAll('script').forEach(function(old) {
      var s = document.createElement('script');
      s.textContent = old.textContent;
      old.parentNode.replaceChild(s, old);
    });
  } catch(e) {
    console.warn('Impossible de charger ' + filePath, e);
  }
}

async function initLayout() {
  var isMinimal = document.body.classList.contains('minimal-layout');
  var isClient = document.body.classList.contains('client-layout');
  var headerFile = '/header.html';
  if (isMinimal) headerFile = '/header-minimal.html';
  else if (isClient) headerFile = '/header-client.html';
  await loadComponent('header-container', headerFile);
  document.dispatchEvent(new Event('header:loaded'));
  Session.updateNav();
  highlightActiveNav();
  await loadComponent('footer-container', isMinimal ? '/footer-minimal.html' : '/footer.html');
}

function highlightActiveNav() {
  var current = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-link[href]').forEach(function(a) {
    a.classList.toggle('active', a.getAttribute('href') === current);
  });
}

// ─── SCROLL REVEAL ───────────────────────────────────────────
function initReveal() {
  var els = document.querySelectorAll('.reveal');
  if (!els.length) return;
  var obs = new IntersectionObserver(function(entries) {
    entries.forEach(function(e, i) {
      if (e.isIntersecting) {
        setTimeout(function() { e.target.classList.add('visible'); }, i * 80);
        obs.unobserve(e.target);
      }
    });
  }, { threshold: 0.12 });
  els.forEach(function(el) { obs.observe(el); });
}

// ─── ALERTES ────────────────────────────────────────────────
function showAlert(id, message, type) {
  type = type || 'danger';
  var el = document.getElementById(id);
  if (!el) return;
  el.className = 'alert alert-' + type;
  el.textContent = message;
  el.style.display = 'flex';
  if (type === 'success') setTimeout(function() { el.style.display = 'none'; }, 5000);
}

function hideAlert(id) {
  var el = document.getElementById(id);
  if (el) el.style.display = 'none';
}

// ─── BOUTON LOADER ───────────────────────────────────────────
function btnLoading(btn, loading, fallback) {
  if (loading) {
    btn._txt = btn.innerHTML;
    btn.innerHTML = '<span class="spinner"></span>';
    btn.disabled = true;
  } else {
    btn.innerHTML = btn._txt || fallback || 'Envoyer';
    btn.disabled = false;
  }
}

// ─── TOAST ───────────────────────────────────────────────────
function toast(message, type, duration) {
  type = type || 'success';
  duration = duration || 3500;
  var colors = { success:'#10B981', danger:'#EF4444', warning:'#F59E0B', info:'#2B2B2B' };
  var t = document.createElement('div');
  t.style.cssText = [
    'position:fixed;bottom:24px;right:24px;z-index:9999',
    'background:' + (colors[type] || colors.info),
    'color:#fff;padding:13px 22px;border-radius:12px',
    'font-size:.9rem;font-weight:500',
    'box-shadow:0 8px 32px rgba(0,0,0,.2)',
    'max-width:340px;animation:fadeIn .3s ease both'
  ].join(';');
  t.textContent = message;
  document.body.appendChild(t);
  setTimeout(function() {
    t.style.opacity = '0';
    t.style.transform = 'translateY(10px)';
    t.style.transition = 'all .3s';
    setTimeout(function() { t.remove(); }, 300);
  }, duration);
}

// ─── STATS LIVE ──────────────────────────────────────────────
async function loadStats() {
  var containers = document.querySelectorAll('[data-stat]');
  if (!containers.length) return;
  try {
    var data = await API.stats();
    containers.forEach(function(el) {
      var key = el.dataset.stat;
      if (data[key] !== undefined) el.textContent = data[key];
    });
  } catch(e) { /* stats non critiques */ }
}

// ─── MODAL ───────────────────────────────────────────────────
function openModal(id) {
  var m = document.getElementById(id);
  if (m) { m.classList.add('open'); document.body.style.overflow = 'hidden'; }
}
function closeModal(id) {
  var m = document.getElementById(id);
  if (m) { m.classList.remove('open'); document.body.style.overflow = ''; }
}
document.addEventListener('click', function(e) {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('open'); document.body.style.overflow = '';
  }
});

// ─── PAGE LOADER ─────────────────────────────────────────────
function hidePageLoader() {
  var loader = document.getElementById('page-loader');
  if (loader) {
    loader.classList.add('hidden');
    setTimeout(function() { loader.remove(); }, 400);
  }
}

// ─── INIT ────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async function() {
  await initLayout();
  initReveal();
  await loadStats();
  hidePageLoader();
});