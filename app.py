"""
BatiFlash — API Flask + site statique + Stripe Checkout.

Lancement local : flask --app app run --debug
Production     : gunicorn app:app
"""
from __future__ import annotations

import logging
from functools import wraps
from pathlib import Path

import stripe
from flask import Flask, jsonify, request, send_from_directory

from config import (
    FLASK_SECRET_KEY,
    PUBLIC_BASE_URL,
    STRIPE_PUBLISHABLE_KEY,
    STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET,
)
from database import (
    fulfill_lead_purchase,
    get_artisan_by_email,
    get_artisan_by_id,
    get_artisan_by_token,
    get_lead,
    get_lead_by_stripe_session,
    init_db,
    list_available_leads,
    list_purchased_leads,
    release_reserved_lead,
    reserve_lead_for_checkout,
)
from notifications import send_lead_purchase_notifications

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent

app = Flask(__name__, static_folder=str(BASE_DIR), static_url_path="")
app.secret_key = FLASK_SECRET_KEY

if STRIPE_SECRET_KEY:
    stripe.api_key = STRIPE_SECRET_KEY

init_db()


def _get_token() -> str | None:
    return request.args.get("token") or (request.json or {}).get("token") or request.headers.get("X-Artisan-Token")


def require_artisan(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = _get_token()
        if not token:
            return jsonify({"error": "Token manquant"}), 401
        artisan = get_artisan_by_token(token)
        if not artisan:
            return jsonify({"error": "Token invalide"}), 401
        return f(artisan, *args, **kwargs)

    return decorated


# ——— Fichiers statiques ———

@app.route("/")
def home():
    return send_from_directory(BASE_DIR, "index.html")


@app.route("/artisan-dashboard.html")
def artisan_dashboard_page():
    return send_from_directory(BASE_DIR, "artisan-dashboard.html")


@app.route("/mentions-legales.html")
def legal():
    return send_from_directory(BASE_DIR, "mentions-legales.html")


@app.route("/<path:filepath>")
def static_files(filepath: str):
    allowed = {"css", "js", "images", "assets"}
    if filepath.split("/")[0] not in allowed and not filepath.endswith(".html"):
        return jsonify({"error": "Not found"}), 404
    target = BASE_DIR / filepath
    if not target.is_file():
        return jsonify({"error": "Not found"}), 404
    return send_from_directory(BASE_DIR, filepath)


# ——— Config publique (Stripe publishable key) ———

@app.route("/api/config")
def public_config():
    return jsonify(
        {
            "stripePublishableKey": STRIPE_PUBLISHABLE_KEY,
            "publicBaseUrl": PUBLIC_BASE_URL,
        }
    )


# ——— Auth artisan (email sans mot de passe) ———

@app.route("/api/artisan/auth/email", methods=["POST"])
def auth_email():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip()
    if not email:
        return jsonify({"error": "Email requis"}), 400
    artisan = get_artisan_by_email(email)
    if not artisan:
        return jsonify(
            {
                "error": "Aucun compte trouvé. Inscrivez-vous via Telegram : /start artisan",
            }
        ), 404
    return jsonify(
        {
            "token": artisan["auth_token"],
            "name": artisan["name"],
            "dashboardUrl": f"{PUBLIC_BASE_URL}/artisan-dashboard.html?token={artisan['auth_token']}",
        }
    )


@app.route("/api/artisan/me")
@require_artisan
def artisan_me(artisan):
    return jsonify(
        {
            "id": artisan["id"],
            "name": artisan["name"],
            "email": artisan["email"],
            "phone": artisan["phone"],
            "hasTelegram": bool(artisan.get("telegram_chat_id")),
        }
    )


# ——— Leads ———

@app.route("/api/artisan/leads")
@require_artisan
def artisan_leads_available(artisan):
    return jsonify({"leads": list_available_leads()})


@app.route("/api/artisan/leads/purchased")
@require_artisan
def artisan_leads_purchased(artisan):
    leads = list_purchased_leads(artisan["id"])
    return jsonify({"leads": leads})


@app.route("/api/artisan/leads/<int:lead_id>")
@require_artisan
def artisan_lead_detail(artisan, lead_id: int):
    lead = get_lead(lead_id)
    if not lead:
        return jsonify({"error": "Lead introuvable"}), 404
    if lead["status"] == "sold" and lead.get("buyer_artisan_id") == artisan["id"]:
        return jsonify({"lead": lead})
    if lead["status"] == "available":
        from database import _mask_lead_public

        return jsonify({"lead": _mask_lead_public(lead)})
    return jsonify({"error": "Lead non disponible"}), 403


@app.route("/api/artisan/release/<int:lead_id>", methods=["POST"])
@require_artisan
def artisan_release(artisan, lead_id: int):
    """Libère un lead réservé après annulation du paiement."""
    lead = get_lead(lead_id)
    if lead and lead.get("status") == "reserved" and lead.get("buyer_artisan_id") == artisan["id"]:
        release_reserved_lead(lead_id)
    return jsonify({"ok": True})


@app.route("/api/artisan/purchase/<int:lead_id>", methods=["POST"])
@require_artisan
def artisan_purchase(artisan, lead_id: int):
    if not STRIPE_SECRET_KEY:
        return jsonify({"error": "Stripe non configuré (STRIPE_SECRET_KEY)"}), 503

    lead = get_lead(lead_id)
    if not lead:
        return jsonify({"error": "Lead introuvable"}), 404
    if lead["status"] != "available":
        return jsonify({"error": "Ce lead n'est plus disponible"}), 409

    token = _get_token()
    price_cents = lead["price_cents"]
    trade = lead.get("trade_type", "Travaux")

    try:
        session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            mode="payment",
            line_items=[
                {
                    "price_data": {
                        "currency": "eur",
                        "unit_amount": price_cents,
                        "product_data": {
                            "name": f"Lead BatiFlash #{lead_id}",
                            "description": f"{trade} — {lead.get('location_city', '')}",
                        },
                    },
                    "quantity": 1,
                }
            ],
            metadata={
                "lead_id": str(lead_id),
                "artisan_id": str(artisan["id"]),
            },
            success_url=(
                f"{PUBLIC_BASE_URL}/artisan-dashboard.html"
                f"?token={token}&success=1&lead_id={lead_id}"
            ),
            cancel_url=(
                f"{PUBLIC_BASE_URL}/artisan-dashboard.html"
                f"?token={token}&cancel=1&lead_id={lead_id}"
            ),
        )
    except stripe.error.StripeError as e:
        logger.exception("Stripe error")
        return jsonify({"error": str(e.user_message if hasattr(e, "user_message") else e)}), 502

    if not reserve_lead_for_checkout(lead_id, artisan["id"], session.id):
        return jsonify({"error": "Impossible de réserver ce lead"}), 409

    return jsonify({"checkoutUrl": session.url, "sessionId": session.id})


# ——— Webhook Stripe ———

@app.route("/stripe-webhook", methods=["POST"])
def stripe_webhook():
    payload = request.get_data()
    sig_header = request.headers.get("Stripe-Signature", "")

    if not STRIPE_WEBHOOK_SECRET:
        logger.error("STRIPE_WEBHOOK_SECRET manquant")
        return jsonify({"error": "Webhook non configuré"}), 500

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, STRIPE_WEBHOOK_SECRET)
    except ValueError:
        return jsonify({"error": "Payload invalide"}), 400
    except stripe.error.SignatureVerificationError:
        return jsonify({"error": "Signature invalide"}), 400

    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        _handle_checkout_completed(session)
    elif event["type"] == "checkout.session.expired":
        session = event["data"]["object"]
        lead_id = session.get("metadata", {}).get("lead_id")
        if lead_id:
            release_reserved_lead(int(lead_id))

    return jsonify({"received": True}), 200


def _handle_checkout_completed(session: dict) -> None:
    metadata = session.get("metadata") or {}
    lead_id = int(metadata.get("lead_id", 0))
    artisan_id = int(metadata.get("artisan_id", 0))
    if not lead_id or not artisan_id:
        existing = get_lead_by_stripe_session(session.get("id", ""))
        if existing:
            lead_id = existing["id"]
            artisan_id = existing.get("buyer_artisan_id") or artisan_id
        else:
            logger.error("Metadata manquante dans session Stripe %s", session.get("id"))
            return

    payment_intent = session.get("payment_intent")
    lead = fulfill_lead_purchase(lead_id, artisan_id, payment_intent)
    if not lead:
        logger.warning("Lead #%s déjà traité ou indisponible", lead_id)
        lead = get_lead(lead_id)
        if not lead or lead.get("buyer_artisan_id") != artisan_id:
            return

    artisan = get_artisan_by_id(artisan_id)
    if artisan and lead.get("status") == "sold":
        send_lead_purchase_notifications(artisan, lead)
        logger.info("Lead #%s vendu à artisan #%s", lead_id, artisan_id)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
