/**
 * BâtiSwift AI — ai-dashboard.js
 * Contrôleur du Tableau de bord BâtiSwift AI.
 * Récupère l'état réel des modules côté serveur et gère les activations.
 *
 * Règle : un retour Stripe (?sub_success=1) NE PROUVE PAS qu'un module est actif.
 * Seule la réponse du serveur (webhook Stripe → base → /api/ai/<module>/status) fait foi.
 */

const AI_MODULE_ID_RE = /^[a-z_]{1,30}$/;

function esc(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

const ICON_CHECK = '<svg class="bs-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><use href="#ic-check"/></svg>';
const ICON_SHIELD = '<svg class="bs-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><use href="#ic-shield"/></svg>';

function showBanner(kind, text) {
  const alertContainer = document.getElementById('ai-alert-banner');
  if (!alertContainer) return;
  const ok = kind === 'success';
  const info = kind === 'pending';
  const color = ok ? 'var(--bs-success)' : 'var(--bs-warning)';
  const bg = ok ? 'var(--bs-success-bg)' : 'var(--bs-warning-bg)';
  alertContainer.innerHTML = '';
  const box = document.createElement('div');
  box.style.cssText = `background:${bg};border:1px solid ${color};color:${color};padding:1rem;border-radius:10px;margin-bottom:1.5rem;font-weight:600;display:flex;align-items:center;gap:0.75rem;`;
  box.innerHTML = ok ? ICON_CHECK : ICON_SHIELD;
  const span = document.createElement('span');
  span.textContent = text; // textContent : jamais de HTML issu de l'URL
  box.appendChild(span);
  alertContainer.appendChild(box);
}

async function renderModules() {
  const container = document.getElementById('ai-modules-container');
  const countEl = document.getElementById('ai-active-count');

  try {
    const res = await AIApi.getModules();
    const modules = res.modules || [];

    let activeCount = 0;
    container.innerHTML = '';

    modules.forEach((mod) => {
      if (mod.is_active) activeCount++;

      const card = document.createElement('div');
      card.className = `ai-module-card ${mod.is_active ? 'card-active' : 'card-inactive'}`;

      const statusBadge = mod.is_active
        ? `<span class="card-status-badge badge-active">Actif</span>`
        : `<span class="card-status-badge badge-inactive">Disponible</span>`;

      const featuresHtml = (mod.features || [])
        .map(
          (f) => `
          <li>
            <svg class="bs-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><use href="#ic-check"/></svg>
            <span>${esc(f)}</span>
          </li>
        `
        )
        .join('');

      const safeId = AI_MODULE_ID_RE.test(mod.id) ? mod.id : '';
      const actionBtn = mod.is_active
        ? `<a href="modules/${esc(safeId.replace(/_/g, '-'))}.html" class="btn-open-module">
             Ouvrir l'outil
             <svg class="bs-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><use href="#ic-arrow-right"/></svg>
           </a>`
        : `<button type="button" class="btn-activate-module" data-module="${esc(safeId)}">
             Activer ce module
             <svg class="bs-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><use href="#ic-lightning"/></svg>
           </button>`;

      card.innerHTML = `
        <div class="card-header-top">
          <div class="card-icon-wrapper">
            <svg class="bs-icon" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><use href="#${esc(mod.icon)}"/></svg>
          </div>
          ${statusBadge}
        </div>
        <h3 class="card-title">${esc(mod.name)}</h3>
        <p class="card-desc">${esc(mod.short_desc)}</p>
        <ul class="card-features-list">
          ${featuresHtml}
        </ul>
        <div class="card-footer">
          <div class="card-price">
            ${mod.is_active ? '<span style="color:var(--bs-success);font-size:1.1rem;">Inclus</span>' : `${esc(mod.price_eur)}€ <small>/ mois</small>`}
          </div>
          ${actionBtn}
        </div>
      `;

      const btn = card.querySelector('.btn-activate-module');
      if (btn) {
        btn.addEventListener('click', () => window.handleSubscribe(btn.dataset.module, btn));
      }

      container.appendChild(card);
    });

    if (countEl) {
      countEl.textContent = `${activeCount} / ${modules.length} modules activés`;
    }
    return modules;
  } catch (err) {
    if (err && err.redirecting) return [];
    console.error('Erreur chargement modules:', err);
    if (container) {
      container.innerHTML = '';
      const box = document.createElement('div');
      box.style.cssText = 'background:var(--bs-danger-bg);color:var(--bs-danger);padding:1.5rem;border-radius:12px;border:1px solid var(--bs-danger);grid-column: 1 / -1;';
      box.textContent = `Impossible de contacter le serveur BâtiSwift AI (${err.message}). Vérifiez votre connexion ou reconnectez-vous.`;
      container.appendChild(box);
    }
    return [];
  }
}

// Après un retour Stripe : on interroge le serveur jusqu'à confirmation (le webhook peut arriver avec un léger retard).
async function confirmActivation(moduleId) {
  const MAX_TRIES = 10;
  for (let i = 0; i < MAX_TRIES; i++) {
    try {
      await AIApi.checkModuleStatus(moduleId);
      showBanner('success', 'Votre abonnement est confirmé : le module est actif sur votre compte.');
      await renderModules();
      return;
    } catch (err) {
      if (err && err.redirecting) return;
      // 403 « abonnement requis » = webhook pas encore reçu : on réessaie.
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  showBanner('pending', "Paiement reçu. L'activation n'est pas encore confirmée par le serveur : actualisez la page dans quelques instants. Si le module reste inactif, contactez le support.");
}

document.addEventListener('DOMContentLoaded', async () => {
  if (!AIAuth.init()) return;

  // 1. Détection des retours de paiement Stripe
  const params = new URLSearchParams(window.location.search);
  const modParam = params.get('module') || '';
  const moduleId = AI_MODULE_ID_RE.test(modParam) ? modParam : '';

  if (params.get('sub_success') === '1') {
    showBanner('pending', "Paiement reçu. Vérification de l'activation auprès du serveur…");
  } else if (params.get('sub_canceled') === '1') {
    showBanner('warning', "La souscription a été annulée. Aucun prélèvement n'a été effectué.");
  }

  // 2. Chargement des modules depuis l'API
  await renderModules();

  // 3. Confirmation serveur après paiement
  if (params.get('sub_success') === '1') {
    if (moduleId) {
      confirmActivation(moduleId);
    } else {
      showBanner('pending', "Paiement reçu. Actualisez la page dans quelques instants pour voir vos modules actifs.");
    }
  }
});

// Déclencheur du paiement Stripe Checkout pour un module
window.handleSubscribe = async function (moduleId, btn) {
  if (!btn) return;
  const originalText = btn.innerHTML;
  btn.disabled = true;
  btn.textContent = 'Redirection Stripe...';

  try {
    const res = await AIApi.createCheckoutSession(moduleId);
    if (res.checkout_url) {
      window.location.href = res.checkout_url;
    } else {
      throw new Error("L'URL de paiement n'a pas été générée.");
    }
  } catch (err) {
    if (!(err && err.redirecting)) alert(`Erreur lors de l'activation : ${err.message}`);
    btn.disabled = false;
    btn.innerHTML = originalText;
  }
};

