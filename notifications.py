"""Notifications artisans — Telegram et email après achat de lead."""
from __future__ import annotations

import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Any

import httpx

from config import (
    SMTP_FROM,
    SMTP_HOST,
    SMTP_PASSWORD,
    SMTP_PORT,
    SMTP_USER,
    TELEGRAM_BOT_TOKEN,
)
from database import _budget_label, _urgency_label

logger = logging.getLogger(__name__)


def format_lead_full(lead: dict[str, Any]) -> str:
    photos = lead.get("photo_urls") or []
    lines = [
        "✅ *Lead BatiFlash débloqué*",
        "",
        f"🔧 *Travaux :* {lead.get('trade_type', '—')}",
        f"📍 *Ville :* {lead.get('location_city', '—')}",
        f"📮 *CP :* {lead.get('location_postal') or '—'}",
        f"🏠 *Adresse :* {lead.get('location_address') or '—'}",
        f"💰 *Budget :* {_budget_label(lead.get('budget_min'), lead.get('budget_max'))}",
        f"⏱ *Urgence :* {_urgency_label(lead.get('urgency'))}",
        "",
        f"📝 *Description :*\n{lead.get('description') or '—'}",
        "",
        "👤 *Client*",
        f"• Nom : {lead.get('client_name') or '—'}",
        f"• Tél : {lead.get('client_phone') or '—'}",
        f"• Email : {lead.get('client_email') or '—'}",
        f"• Photos : {len(photos)} (voir sur Telegram si envoyées au bot)",
    ]
    return "\n".join(lines)


def send_telegram_message(chat_id: int, text: str, parse_mode: str = "Markdown") -> bool:
    if not TELEGRAM_BOT_TOKEN or not chat_id:
        logger.warning("Telegram non configuré ou chat_id manquant")
        return False
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    try:
        r = httpx.post(
            url,
            json={"chat_id": chat_id, "text": text, "parse_mode": parse_mode},
            timeout=15.0,
        )
        r.raise_for_status()
        return True
    except Exception as e:
        logger.exception("Erreur envoi Telegram: %s", e)
        return False


def send_lead_purchase_notifications(artisan: dict[str, Any], lead: dict[str, Any]) -> None:
    """Envoie le lead complet à l'artisan par Telegram (+ email si configuré)."""
    message = format_lead_full(lead)
    chat_id = artisan.get("telegram_chat_id")
    if chat_id:
        ok = send_telegram_message(int(chat_id), message)
        if ok:
            logger.info("Lead #%s envoyé sur Telegram à artisan #%s", lead.get("id"), artisan.get("id"))
    else:
        logger.warning("Artisan #%s sans telegram_chat_id", artisan.get("id"))

    email = artisan.get("email")
    if email and SMTP_HOST and SMTP_USER:
        send_lead_email(email, lead, message.replace("*", ""))


def send_lead_email(to_email: str, lead: dict[str, Any], body_text: str) -> bool:
    try:
        msg = MIMEMultipart()
        msg["From"] = SMTP_FROM
        msg["To"] = to_email
        msg["Subject"] = f"BatiFlash — Coordonnées client (lead #{lead.get('id')})"
        msg.attach(MIMEText(body_text, "plain", "utf-8"))
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.send_message(msg)
        return True
    except Exception as e:
        logger.exception("Erreur email: %s", e)
        return False
