# BatiFlash — Intégration espace artisan + Stripe

## Architecture

| Composant | Fichier | Rôle |
|-----------|---------|------|
| Site vitrine | `index.html` | Clients |
| Espace pro | `artisan-dashboard.html` | Artisans — achat de leads |
| API + static | `app.py` | Flask, Stripe, JSON |
| Bot Telegram | `agent.py` | Sarah + inscription artisans |
| Base | `data/batiflash.db` | SQLite (artisans + leads) |

## 1. Variables d'environnement

Copiez `.env.example` vers `.env` et renseignez :

```bash
cp .env.example .env
```

| Variable | Où la trouver |
|----------|----------------|
| `TELEGRAM_BOT_TOKEN` | [@BotFather](https://t.me/BotFather) |
| `PUBLIC_BASE_URL` | URL Render du service web, ex. `https://batiflash.onrender.com` |
| `STRIPE_SECRET_KEY` | Stripe → Développeurs → Clés API (mode test puis live) |
| `STRIPE_PUBLISHABLE_KEY` | Idem (clé publiable `pk_`) |
| `STRIPE_WEBHOOK_SECRET` | Stripe → Développeurs → Webhooks (voir étape 3) |

## 2. Lancer en local

```bash
pip install -r requirements.txt
python agent.py          # Terminal 1 — bot Telegram
flask --app app run -p 5000   # Terminal 2 — site + API
```

- Site : http://localhost:5000  
- Espace pro : http://localhost:5000/artisan-dashboard.html  
- Inscription artisan : Telegram `/start artisan` ou lien `https://t.me/VOTRE_BOT?start=artisan`

## 3. Configurer Stripe

### Compte et clés

1. Créez un compte sur [stripe.com](https://stripe.com).
2. Mode **Test** pour développer (cartes test : `4242 4242 4242 4242`).
3. Copiez `sk_test_...` et `pk_test_...` dans `.env` / Render.

### Webhook (obligatoire pour débloquer les leads)

1. Stripe → **Développeurs** → **Webhooks** → **Ajouter un endpoint**.
2. URL : `https://VOTRE-DOMAINE.onrender.com/stripe-webhook`
3. Événements à écouter :
   - `checkout.session.completed`
   - `checkout.session.expired` (libère un lead réservé)
4. Copiez le **Signing secret** (`whsec_...`) dans `STRIPE_WEBHOOK_SECRET`.

En local avec [Stripe CLI](https://stripe.com/docs/stripe-cli) :

```bash
stripe listen --forward-to localhost:5000/stripe-webhook
```

### Flux paiement

1. L’artisan clique **Acheter ce lead** → `POST /api/artisan/purchase/<id>`.
2. Le lead passe en statut `reserved`.
3. Redirection vers **Stripe Checkout** (paiement unique → votre compte Stripe).
4. Webhook `checkout.session.completed` → lead `sold` → notification Telegram + email.

Tarifs automatiques :

| Budget chantier | Prix lead |
|-----------------|-----------|
| ≤ 500 € | 10 € |
| 500 – 2000 € | 15 € |
| > 2000 € | 20 € |

## 4. Déployer sur Render

1. Poussez le repo sur GitHub.
2. Render → **New Blueprint** → `render.yaml` (2 services + disque partagé `/data`).
3. Renseignez les variables secrètes identiques sur **web** et **worker**.
4. `PUBLIC_BASE_URL` = URL du service `batiflash-web`.

**Important** : web et bot doivent partager le même `DATABASE_PATH` (`/data/batiflash.db`) via le disque persistant.

## 5. Routes API

| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/api/artisan/auth/email` | Connexion par email (sans mot de passe) |
| GET | `/api/artisan/me?token=` | Profil artisan |
| GET | `/api/artisan/leads?token=` | Leads disponibles (masqués) |
| GET | `/api/artisan/leads/purchased?token=` | Leads achetés (coordonnées complètes) |
| POST | `/api/artisan/purchase/<id>?token=` | Crée session Stripe Checkout |
| POST | `/api/artisan/release/<id>?token=` | Libère un lead après annulation |
| POST | `/stripe-webhook` | Confirmation Stripe |

## 6. Connexion artisan

- **Telegram** (recommandé) : `/start artisan` ou `/pro` → lien dashboard avec `?token=...`
- **Email** : même email qu’à l’inscription sur le dashboard

Le token est stocké dans `localStorage` et dans l’URL.

## 7. Modifier les liens du site

Éditez `js/config.js` :

```javascript
telegram: {
  botUsername: "votre_bot",
  artisanWaitlistUrl: "https://t.me/votre_bot?start=artisan",
},
```

## 8. Sécurité (production)

- Passez Stripe en mode **Live** avec clés `sk_live_` / `pk_live_`.
- Utilisez HTTPS uniquement (`PUBLIC_BASE_URL` en `https://`).
- L’auth par email seul convient au MVP ; ajoutez plus tard un lien magique ou OAuth si besoin.
- Ne commitez jamais `.env` ni `data/*.db`.
