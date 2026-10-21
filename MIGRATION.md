# Migration emojis → icônes BâtiSwift

Correspondance établie à partir de l’audit des emojis restants. **Ce document ne modifie aucun fichier du projet** : il sert de feuille de route pour Cline.

## Règles générales
- **`<title>`, `console.log`, `console.error`** : un SVG est impossible → retirer l’emoji, garder le texte.
- **HTML statique** : insérer le SVG en ligne (contenu du fichier `icons/ic-xxx.svg`) avec une classe, ex. `class="bs-icon"`.
- **Chaînes JavaScript** : charger `icons.css` + `icons.js`, puis `bsIcon('ic-check', 16)` dans un `innerHTML`.
  Si le message contient une donnée utilisateur, l’échapper avant (`textContent` pour la partie variable).
- **⏳ en chargement** : `bsIcon('ic-loader', 16, 'bs-icon-spin')` (rotation CSS fournie).
- Les icônes héritent de `currentColor` : la couleur suit le texte (succès, erreur…) sans SVG supplémentaire.

## Correspondance globale
| Emoji | Icône | Emoji | Icône |
|---|---|---|---|
| 📊 | `ic-chart` | 📍 | `ic-location-pin` |
| 📋 | `ic-clipboard` | 💰 | `ic-money` |
| 🤖 | `ic-ia-robot` | ✅ | `ic-check` |
| 💬 | `ic-chat` | ✓ (timeline) | `ic-tick` |
| ⚠️ | `ic-warning` | ● (timeline) | pastille CSS, pas d’icône |
| 🗺️ | `ic-map` (`ic-carte` pour les chantiers) | 👁 / 🙈 | `ic-eye` / `ic-eye-off` |
| ⏳ | `ic-loader` | 🎉 | `ic-sparkles` |
| ℹ️ | `ic-info` | 👤 | `ic-user` |
| 📦 | `ic-achats` (liens) / `ic-package` | 💾 | `ic-save` |
| ❌ | `ic-error` | 🔐 | `ic-lock` |
| 🔥 | `ic-fire` (`ic-marketplace` pour le titre Marketplace) | 📧 | `ic-mail` |
| ⚙️ | `ic-parametres` | 👋 | aucune : retirer |
| 🚪 | `ic-deconnexion` | 🕓 | `ic-clock` |
| 🚨 | `ic-siren` | ⚡ | `ic-lightning` |
| 📅 | `ic-calendar` | 💳 | `ic-credit-card` |

## Par fichier
**admin.html** — 90 📊 → `ic-chart` · 100 📋 → `ic-clipboard`

**aide.html** — 281 🤖 → `ic-ia-robot` · 322 💬 → `ic-chat` · 497, 503 🤖 (préfixe question) → `ic-ia-robot` · 504 ⚠️ → `ic-warning`

**carte-client.html** — 6 🗺️ (`<title>`) → retirer · 228 🗺️ → `ic-map` · 265 ⏳ → `ic-loader` · 266 ⚠️ → `ic-warning` · 267 ℹ️ → `ic-info` · 393 📦 (console.log) → retirer

**carte.html** — 6 🗺️ (`<title>`) → retirer · 570 🗺️ et 572 ❌ (console) → retirer

**leads.html** — 88 📋 → `ic-list` · 89 🔥 → `ic-fire` · 90 📦 → `ic-achats` · 91 ⚙️ → `ic-parametres` · 92 🚪 → `ic-deconnexion` · 96 🔥 → `ic-fire` · 166 🚨 / 📅 → `ic-siren` / `ic-calendar` · 168 🔥 → `ic-fire`

**marketplace.html** — 52 🔥 → `ic-marketplace` · 56 📦 → `ic-achats` · 57 ⚙️ → `ic-parametres` · 71, 133, 232 ⏳ → `ic-loader` · 90, 227, 247, 268 💳 → `ic-credit-card` · 121 🚨 / 📅 / 🕓 / ⚡ → `ic-siren` / `ic-calendar` / `ic-clock` / `ic-lightning` · 189, 214 📍 → `ic-location-pin` · 214 💰 → `ic-money` · 264 ✅ → `ic-check`

**achats.html** — 479 ⏳ → `ic-loader`

**client.html** — 279, 283, 287 ⚠️ → `ic-warning` · 324 ✅ → `ic-check` · 343 👋 → retirer

**client-dashboard.html** — 550 💬 → `ic-chat` · 574 📅 → `ic-calendar` · 579 📍 → `ic-location-pin` · 583-592 ✓ → `ic-tick`, ● → pastille CSS

**connexion.html** — 172 👁 / 🙈 → `ic-eye` / `ic-eye-off` (échanger le SVG au clic, ajouter `aria-label`)

**inscription.html** — 431 🎉 → `ic-sparkles` (ou retirer dans le toast)

**parametres.html** — 655, 701 ⏳ → `ic-loader` · 672 ✅ → `ic-check` · 677, 703, 738 ❌ → `ic-error`

**profil.html** — 76 👤 → `ic-user` · 100 💾 → `ic-save` · 159 ✅ → `ic-check` · 162 ❌ → `ic-error`

**reset-password.html** — 27 🔐 → `ic-lock` · 143 ✅ → `ic-check` · 158, 172 ❌ → `ic-error`

**forgot-password.html** — 27 📧 → `ic-mail` · 103 ✅ → `ic-check` · 111, 122 ❌ → `ic-error`

## Accessibilité
Les SVG sont décoratifs (`aria-hidden="true"`). Pour un bouton icône seul (👁/🙈), ajouter un `aria-label` sur le `<button>`.
