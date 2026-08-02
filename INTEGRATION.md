# BâtiSwift — Intégration espace artisan + Stripe

## Architecture

| Composant | Fichier | Rôle |
|-----------|---------|------|
| Site vitrine | `index.html` | Clients |
| Dashboard artisan | `dashboard.html` | Artisans — achat de leads |
| Backend API | `agent.py` | Flask, Stripe, Gemini, Brevo, Infobip, JWT |
| Agent IA | `agent.py` | Qualification, FAQ, emails, relances |
| Base de données | PostgreSQL (Render) / SQLite (local) | Artisans + Leads + Avis |
| Planificateur | APScheduler | Relances automatiques J+4 / J+7 |

---

## 1. Variables d'environnement

| Variable | Où la trouver |
|----------|----------------|
| `GEMINI_API_KEY` | [Google AI Studio](https://aistudio.google.com/) |
| `STRIPE_SECRET_KEY` | Stripe → Développeurs → Clés API |
| `STRIPE_PUBLISHABLE_KEY` | Idem (clé publiable `pk_`) |
| `STRIPE_WEBHOOK_SECRET` | Stripe → Développeurs → Webhooks |
| `INFOBIP_API_KEY` | [Infobip](https://www.infobip.com/) → API Keys |
| `INFOBIP_BASE_URL` | `https://api.infobip.com` |
| `INFOBIP_SENDER` | Numéro WhatsApp vérifié |
| `BREVO_API_KEY` | [Brevo](https://www.brevo.com/) → SMTP & API |
| `BREVO_SENDER_EMAIL` | Email vérifié (ex: `contact@batiswift.com`) |
| `BREVO_SENDER_NAME` | `BâtiSwift` |
| `DEEPL_API_KEY` | [DeepL](https://www.deepl.com/pro-api) |
| `DATABASE_URL` | URL PostgreSQL sur Render (ou SQLite) |
| `FRONTEND_URL` | `https://batiswift.onrender.com` |
| `SECRET_KEY` | Clé secrète Flask (générée aléatoirement) |
| `JWT_SECRET` | Clé pour les tokens JWT |

---

## 2. Lancer en local

```bash
pip install -r requirements.txt
python agent.py