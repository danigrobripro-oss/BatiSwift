/**
 * BâtiSwift AI — ai-ui.js
 * Composants TRANSVERSAUX uniquement (aucune interface métier) : construction DOM sûre, notifications,
 * fenêtres modales/confirmation, formats, et amorçage d'un module (contrôle d'accès serveur + paywall).
 * Toute donnée affichée passe par textContent : jamais de HTML construit à partir de données utilisateur/IA.
 * Dépend de : ai-api.js, ai-auth.js.
 */
const AIUI = (() => {
  function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'style') el.style.cssText = v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'value') el.value = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    children.flat().forEach((c) => {
      if (c == null || c === false) return;
      el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
    });
    return el;
  }

  const fmtEur = (cents) => (cents == null ? '—' :
    (cents / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' }));
  const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString('fr-FR') : '—');
  const fmtDateTime = (iso) => (iso ? new Date(iso.endsWith('Z') || iso.includes('+') ? iso : iso + 'Z')
    .toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');
  const dayKey = (iso) => (iso || '').slice(0, 10);

  function toast(message, kind = 'info') {
    let box = document.getElementById('ai-toasts');
    if (!box) { box = h('div', { id: 'ai-toasts', 'aria-live': 'polite' }); document.body.appendChild(box); }
    const t = h('div', { class: `ai-toast ai-toast-${kind}`, role: kind === 'error' ? 'alert' : 'status', text: message });
    box.appendChild(t);
    setTimeout(() => t.remove(), kind === 'error' ? 7000 : 3500);
  }

  function modal(title, content, { wide = false, onClose } = {}) {
    const close = () => { overlay.remove(); document.removeEventListener('keydown', esc); if (onClose) onClose(); };
    const esc = (e) => { if (e.key === 'Escape') close(); };
    const overlay = h('div', { class: 'ai-modal-overlay', onclick: (e) => { if (e.target === overlay) close(); } },
      h('div', { class: `ai-modal${wide ? ' wide' : ''}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
        h('div', { class: 'ai-modal-head' }, h('h3', { text: title }),
          h('button', { type: 'button', class: 'ai-x', 'aria-label': 'Fermer', onclick: close, text: '×' })),
        h('div', { class: 'ai-modal-body' }, content)));
    document.body.appendChild(overlay);
    document.addEventListener('keydown', esc);
    return { close };
  }

  function confirmBox(message, okLabel = 'Confirmer') {
    return new Promise((resolve) => {
      let m;
      const done = (v) => { m.close(); resolve(v); };
      m = modal('Confirmation', h('div', null,
        h('p', { text: message, style: 'margin-bottom:1.25rem' }),
        h('div', { class: 'ai-actions' },
          h('button', { type: 'button', class: 'btn', onclick: () => done(false), text: 'Annuler' }),
          h('button', { type: 'button', class: 'btn btn-primary', onclick: () => done(true), text: okLabel }))),
        { onClose: () => resolve(false) });
    });
  }

  // Désactive un bouton pendant une opération asynchrone et affiche l'erreur sans jamais masquer l'état réel.
  async function run(btn, fn, okMsg) {
    const label = btn ? btn.textContent : null;
    if (btn) { btn.disabled = true; btn.textContent = 'En cours…'; }
    try {
      const r = await fn();
      if (okMsg) toast(okMsg, 'success');
      return r;
    } catch (e) {
      if (!(e && e.redirecting)) toast(e.message || 'Une erreur est survenue.', 'error');
      return undefined;
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = label; }
    }
  }

  const badge = (text, kind = 'neutral') => h('span', { class: `ai-badge ai-badge-${kind}`, text });
  const loading = (text = 'Chargement…') => h('div', { class: 'ai-loading', text });
  const empty = (text) => h('div', { class: 'ai-empty', text });
  const field = (label, input, hint) => h('label', { class: 'ai-field' }, h('span', { text: label }), input,
    hint ? h('small', { text: hint }) : null);

  function dropzone(accept, onFiles, label, multiple = false) {
    const input = h('input', { type: 'file', accept, multiple, hidden: true, onchange: () => { onFiles([...input.files]); input.value = ''; } });
    const zone = h('div', { class: 'ai-drop', tabindex: '0', role: 'button',
      onclick: () => input.click(), onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } },
      ondragover: (e) => { e.preventDefault(); zone.classList.add('over'); },
      ondragleave: () => zone.classList.remove('over'),
      ondrop: (e) => { e.preventDefault(); zone.classList.remove('over'); onFiles([...e.dataTransfer.files]); } },
      h('strong', { text: label }), h('small', { text: 'Glisser-déposer ou cliquer pour choisir' }), input);
    return zone;
  }

  function tabs(defs) {
    const bar = h('div', { class: 'ai-tabs', role: 'tablist' });
    const panel = h('div', { class: 'ai-tabpanel' });
    const btns = defs.map((d, i) => h('button', { type: 'button', role: 'tab', class: 'ai-tab', onclick: () => select(i) },
      d.label, d.count ? h('span', { class: 'ai-tab-count', text: String(d.count) }) : null));
    btns.forEach((b) => bar.appendChild(b));
    function select(i) { btns.forEach((b, j) => b.classList.toggle('active', i === j)); panel.replaceChildren(defs[i].render()); }
    select(0);
    return h('div', null, bar, panel);
  }

  const list = (items, cls = 'ai-list') => (items && items.length
    ? h('ul', { class: cls }, items.map((t) => h('li', { text: t }))) : null);

  function header(title, subtitle) {
    return h('div', { class: 'ai-pagehead' }, h('h1', { text: title }), subtitle ? h('p', { text: subtitle }) : null);
  }

  /**
   * Amorce un module : l'accès est décidé par le SERVEUR (/api/ai/<module>/status).
   * 403 « abonnement requis » → paywall (prix lu depuis l'API) ; autre erreur → message d'erreur + réessayer.
   */
  async function bootModule({ id, render }) {
    if (!AIAuth.init()) return;
    const container = document.getElementById('module-content');
    try {
      await AIApi.checkModuleStatus(id);
    } catch (err) {
      if (!AIApi.isPaywall(err)) { AIApi.renderError(container, err); return; }
      await renderPaywall(container, id);
      return;
    }
    container.replaceChildren();
    try { await render(container); } catch (e) { if (!(e && e.redirecting)) AIApi.renderError(container, e); }
  }

  async function renderPaywall(container, id) {
    let mod = { name: id, short_desc: '', price_eur: null, features: [] };
    try { mod = ((await AIApi.getModules()).modules || []).find((m) => m.id === id) || mod; } catch (_) { /* affichage minimal */ }
    const btn = h('button', { type: 'button', class: 'btn-activate-module', style: 'padding:0.75rem 2rem;font-size:1rem;',
      onclick: () => run(btn, async () => {
        const r = await AIApi.createCheckoutSession(id);
        if (!r.checkout_url) throw new Error("L'URL de paiement n'a pas été générée.");
        window.location.href = r.checkout_url;
      }), text: 'Activer ce module maintenant' });
    container.replaceChildren(h('div', { class: 'ai-paywall-container' },
      h('h2', { class: 'paywall-title', text: mod.name }),
      h('p', { class: 'paywall-desc', text: mod.short_desc }),
      list(mod.features),
      mod.price_eur != null ? h('div', { class: 'paywall-price-box' },
        h('div', { class: 'paywall-price-val', text: `${mod.price_eur}€` }),
        h('div', { class: 'paywall-price-period', text: 'par mois • sans engagement' })) : null,
      h('div', null, btn)));
  }

  return { h, fmtEur, fmtDate, fmtDateTime, dayKey, toast, modal, confirmBox, run, badge, loading, empty, field,
           dropzone, tabs, list, header, bootModule };
})();
