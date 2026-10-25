/**
 * BâtiSwift AI — ai-dashboard.js
 * Contrôleur du Tableau de bord BâtiSwift AI.
 * Récupère l'état réel des modules côté serveur et gère les activations.
 */

document.addEventListener('DOMContentLoaded', async () => {
  if (!AIAuth.init()) return;

  const container = document.getElementById('ai-modules-container');
  const countEl = document.getElementById('ai-active-count');
  const alertContainer = document.getElementById('ai-alert-banner');

  // 1. Détection des retours de paiement Stripe
  const params = new URLSearchParams(window.location.search);
  if (params.get('sub_success') === '1') {
    const mod = params.get('module') || 'votre module';
    if (alertContainer) {
      alertContainer.innerHTML = `
        <div style="background:var(--bs-success-bg);border:1px solid var(--bs-success);color:var(--bs-success);padding:1rem;border-radius:10px;margin-bottom:1.5rem;font-weight:600;display:flex;align-items:center;gap:0.75rem;">
          <svg class="bs-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><use href="#ic-check"/></svg>
          Félicitations ! Votre abonnement au module "${mod}" a été validé avec succès.
        </div>
      `;
    }
  } else if (params.get('sub_canceled') === '1') {
    if (alertContainer) {
      alertContainer.innerHTML = `
        <div style="background:var(--bs-warning-bg);border:1px solid var(--bs-warning);color:var(--bs-warning);padding:1rem;border-radius:10px;margin-bottom:1.5rem;font-weight:600;display:flex;align-items:center;gap:0.75rem;">
          <svg class="bs-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><use href="#ic-shield"/></svg>
          La souscription a été annulée. Aucun prélèvement n'a été effectué.
        </div>
      `;
    }
  }

  // 2. Chargement des modules depuis l'API
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

      const featuresHtml = mod.features
        .map(
          (f) => `
          <li>
            <svg class="bs-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><use href="#ic-check"/></svg>
            <span>${f}</span>
          </li>
        `
        )
        .join('');

      const actionBtn = mod.is_active
        ? `<a href="modules/${mod.id}.html" class="btn-open-module">
             Ouvrir l'outil
             <svg class="bs-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><use href="#ic-arrow-right"/></svg>
           </a>`
        : `<button class="btn-activate-module" onclick="handleSubscribe('${mod.id}', ${mod.price_eur})">
             Activer ce module
             <svg class="bs-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><use href="#ic-lightning"/></svg>
           </button>`;

      card.innerHTML = `
        <div class="card-header-top">
          <div class="card-icon-wrapper">
            <svg class="bs-icon" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><use href="#${mod.icon}"/></svg>
          </div>
          ${statusBadge}
        </div>
        <h3 class="card-title">${mod.name}</h3>
        <p class="card-desc">${mod.short_desc}</p>
        <ul class="card-features-list">
          ${featuresHtml}
        </ul>
        <div class="card-footer">
          <div class="card-price">
            ${mod.is_active ? '<span style="color:var(--bs-success);font-size:1.1rem;">Inclus</span>' : `${mod.price_eur}€ <small>/ mois</small>`}
          </div>
          ${actionBtn}
        </div>
      `;

      container.appendChild(card);
    });

    if (countEl) {
      countEl.textContent = `${activeCount} / ${modules.length} modules activés`;
    }
  } catch (err) {
    console.error('Erreur chargement modules:', err);
    if (container) {
      container.innerHTML = `
        <div style="background:var(--bs-danger-bg);color:var(--bs-danger);padding:1.5rem;border-radius:12px;border:1px solid var(--bs-danger);grid-column: 1 / -1;">
          Impossible de contacter le serveur BâtiSwift AI (${err.message}). Vérifiez votre connexion ou reconnectez-vous.
        </div>
      `;
    }
  }
});

// Déclencheur du paiement Stripe Checkout pour un module
window.handleSubscribe = async function (moduleId, priceEur) {
  const btn = event.currentTarget;
  const originalText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = 'Redirection Stripe...';

  try {
    const res = await AIApi.createCheckoutSession(moduleId);
    if (res.checkout_url) {
      window.location.href = res.checkout_url;
    } else {
      throw new Error("L'URL de paiement n'a pas été générée.");
    }
  } catch (err) {
    alert(`Erreur lors de l'activation : ${err.message}`);
    btn.disabled = false;
    btn.innerHTML = originalText;
  }
};

