/*!
 * bs-private-icons.js — Bibliothèque d'icônes SVG de l'espace privé BâtiSwift AI
 * Indépendante de la bibliothèque du site public (icons.js / icons.css). Aucune dépendance, aucun CDN.
 * Emplacement conseillé : espace-prive/bs-private-icons.js (à côté de index.html, dossier js/ si vous préférez).
 *
 * Icônes en contour (grille 24×24), couleur héritée de currentColor, sans fond.
 * Identifiants : "ic-xxx" (ceux déjà utilisés par les pages privées sont conservés tels quels).
 *
 * DEUX MODES D'UTILISATION (au choix, compatibles entre eux) :
 *
 * 1) Sprite — compatible avec le balisage EXISTANT <svg class="bs-icon" …><use href="#ic-grid"/></svg>
 *      <script src="bs-private-icons.js" data-sprite></script>      // injecte le sprite automatiquement
 *      ou BSIcons.injectSprite();                                    // injection manuelle
 *    Les ids déjà présents dans la page ne sont jamais redéfinis (pas de doublon d'id).
 *
 * 2) Inline — sans aucun id dans le DOM :
 *      BSIcons.get('ic-search', { size: 20, className: 'x', label: 'Rechercher' }) -> chaîne SVG
 *      BSIcons.create(name, opts) -> élément <svg>
 *      BSIcons.mount(root?)       -> remplace <span data-bs-icon="check" data-bs-size="18"> par l'icône
 *
 * Accessibilité : sans `label`, l'icône est décorative (aria-hidden). Avec `label`, role="img" + aria-label.
 * Sécurité : contenu SVG statique uniquement ; `label` et `className` sont nettoyés ; jamais de données utilisateur.
 */
(function (global) {
  'use strict';

  var ICONS = {
    // Navigation et interface
    'grid':         '<path d="M3 3h8v10H3zM13 3h8v6h-8zM13 11h8v10h-8zM3 15h8v6H3z"/>',
    'arrow-left':   '<path d="M20 12H4M10 6l-6 6 6 6"/>',
    'arrow-right':  '<path d="M4 12h16M14 6l6 6-6 6"/>',
    'chevron-down': '<path d="M6 9l6 6 6-6"/>',
    'search':       '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21"/>',
    'settings':     '<path d="M4 7h4M12 7h8M4 12h10M18 12h2M4 17h3M11 17h9"/><path d="M8 5h4v4H8zM14 10h4v4h-4zM7 15h4v4H7z"/>',
    'close':        '<path d="M5 5l14 14M19 5L5 19"/>',
    'logout':       '<path d="M10 4H5v16h5M10 12h10M16 8l4 4-4 4"/>',
    'briefcase':    '<path d="M3 8h18v12H3zM9 8V5h6v3M3 13h18M10 13v2h4v-2"/>',
    // IA et communication
    'ai':           '<path d="M5 8h14v11H5zM12 8V5M3 12v3M21 12v3M9 13h.01M15 13h.01M9 16.5h6"/><circle cx="12" cy="4" r="1"/>',
    'sparkles':     '<path d="M11 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2zM19 3v4M17 5h4"/>',
    'mic':          '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M6 11a6 6 0 0 0 12 0M12 17v4M9 21h6"/>',
    'chat':         '<path d="M4 4h16v12H10l-4 4v-4H4z"/>',
    'bell':         '<path d="M6 17v-6a6 6 0 0 1 12 0v6l2 2H4zM10 21h4"/>',
    // Activité BTP et gestion
    'document':     '<path d="M5 3h10l4 4v14H5zM15 3v4h4M8 12h8M8 16h5"/>',
    'calendar':     '<path d="M3 5h18v16H3zM3 10h18M8 3v4M16 3v4"/>',
    'camera':       '<path d="M3 7h4l2-3h6l2 3h4v13H3z"/><circle cx="12" cy="13" r="4"/>',
    'cart':         '<path d="M3 4h3l2 12h11l2-8H7"/><circle cx="9" cy="20" r="1.2"/><circle cx="18" cy="20" r="1.2"/>',
    'shield':       '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
    // États et actions
    'check':        '<path d="M4 12l5 5L20 6"/>',
    'info':         '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
    'warning':      '<path d="M12 3l10 17H2zM12 10v5M12 17.5h.01"/>',
    'error':        '<circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/>',
    'loading':      '<path d="M12 3a9 9 0 1 0 9 9"/>',
    'refresh':      '<path d="M20 11a8 8 0 0 0-14-4M4 4v4h4M4 13a8 8 0 0 0 14 4M20 20v-4h-4"/>',
    'save':         '<path d="M4 4h13l3 3v13H4zM8 4v5h7V4M8 20v-6h8v6"/>',
    'lock':         '<rect x="5" y="11" width="14" height="10"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    'lightning':    '<path d="M13 3L5 13.5h6L10 21l8-10.5h-6z"/>',
    // Indicateurs et données
    'chart':        '<path d="M4 20V4M4 20h16M8 16v-5M13 16V8M18 16v-3"/>',
    'payment':      '<path d="M3 6h18v13H3zM3 10h18M6 15h4"/>'
  };

  var has = function (o, k) { return Object.prototype.hasOwnProperty.call(o, k); };
  var normalize = function (n) { return String(n || '').replace(/^ic-/, ''); };
  var esc = function (s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var safeClass = function (c) { return String(c || '').replace(/[^\w\- ]/g, '').trim(); };

  function get(name, opts) {
    opts = opts || {};
    var key = normalize(name);
    if (!has(ICONS, key)) {
      if (global.console) console.warn('BSIcons : icône inconnue « ' + key + ' »');
      return '';
    }
    var size = parseInt(opts.size, 10);
    if (!(size > 0 && size <= 256)) size = 20;
    var cls = ('bs-ic bs-ic--' + key + ' ' + safeClass(opts.className)).trim();
    var a11y = opts.label
      ? 'role="img" aria-label="' + esc(opts.label) + '"'
      : 'aria-hidden="true" focusable="false"';
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="' + size + '" height="' + size +
      '" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="square" stroke-linejoin="miter"' +
      ' class="' + cls + '" ' + a11y + '>' + ICONS[key] + '</svg>';
  }

  function create(name, opts) {
    var html = get(name, opts);
    if (!html) return null;
    var tpl = document.createElement('template');
    tpl.innerHTML = html;
    return tpl.content.firstChild;
  }

  function mount(root) {
    (root || document).querySelectorAll('[data-bs-icon]').forEach(function (el) {
      var svg = create(el.getAttribute('data-bs-icon'), {
        size: el.getAttribute('data-bs-size'),
        label: el.getAttribute('data-bs-label'),
        className: el.getAttribute('data-bs-class')
      });
      if (svg) el.replaceWith(svg);
    });
  }

  // Sprite : un <symbol id="ic-xxx"> par icône. `skip(id)` permet d'ignorer les ids déjà présents.
  // L'épaisseur du trait reste pilotée par le <svg> appelant (stroke-width), seuls linecap/linejoin sont fixés ici.
  function spriteMarkup(skip) {
    var out = '';
    Object.keys(ICONS).forEach(function (k) {
      var id = 'ic-' + k;
      if (skip && skip(id)) return;
      out += '<symbol id="' + id + '" viewBox="0 0 24 24"><g stroke-linecap="square" stroke-linejoin="miter">' + ICONS[k] + '</g></symbol>';
    });
    return out;
  }

  function injectSprite() {
    if (document.getElementById('bs-private-sprite')) return;
    var markup = spriteMarkup(function (id) { return !!document.getElementById(id); });
    if (!markup) return;
    var tpl = document.createElement('template');
    tpl.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" id="bs-private-sprite" width="0" height="0" ' +
      'style="position:absolute" aria-hidden="true" focusable="false">' + markup + '</svg>';
    (document.body || document.documentElement).insertBefore(tpl.content.firstChild,
      (document.body || document.documentElement).firstChild);
  }

  global.BSIcons = {
    get: get, create: create, mount: mount,
    injectSprite: injectSprite, spriteMarkup: spriteMarkup,
    has: function (n) { return has(ICONS, normalize(n)); },
    names: function () { return Object.keys(ICONS).map(function (k) { return 'ic-' + k; }); }
  };

  // Injection automatique : <script src="bs-private-icons.js" data-sprite></script>
  var cs = document.currentScript;
  if (cs && cs.hasAttribute('data-sprite')) {
    if (document.body) injectSprite();
    else document.addEventListener('DOMContentLoaded', injectSprite);
  }
})(window);
