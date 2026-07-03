"""Base SQLite BatiFlash — artisans et leads."""
from __future__ import annotations

import json
import secrets
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Any

from config import DATABASE_PATH


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


@contextmanager
def get_db():
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db() -> None:
    with get_db() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS artisans (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                phone TEXT,
                email TEXT,
                telegram_user_id INTEGER UNIQUE,
                telegram_chat_id INTEGER,
                auth_token TEXT NOT NULL UNIQUE,
                created_at TEXT NOT NULL,
                subscription_active INTEGER DEFAULT 0,
                stripe_subscription_id TEXT
            );

            CREATE TABLE IF NOT EXISTS leads (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                client_telegram_id INTEGER,
                trade_type TEXT NOT NULL,
                location_city TEXT,
                location_postal TEXT,
                location_address TEXT,
                budget_min INTEGER,
                budget_max INTEGER,
                urgency TEXT DEFAULT 'normal',
                description TEXT,
                client_name TEXT,
                client_phone TEXT,
                client_email TEXT,
                photo_urls TEXT DEFAULT '[]',
                price_cents INTEGER NOT NULL,
                status TEXT NOT NULL DEFAULT 'available',
                buyer_artisan_id INTEGER,
                stripe_session_id TEXT,
                stripe_payment_intent TEXT,
                created_at TEXT NOT NULL,
                sold_at TEXT,
                FOREIGN KEY (buyer_artisan_id) REFERENCES artisans(id)
            );

            CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
            CREATE INDEX IF NOT EXISTS idx_artisans_token ON artisans(auth_token);
            CREATE INDEX IF NOT EXISTS idx_artisans_email ON artisans(email);
            """
        )


def compute_lead_price_cents(budget_min: int | None, budget_max: int | None) -> int:
    """10 € / 15 € / 20 € selon l'enveloppe budgétaire."""
    bmax = budget_max or budget_min or 0
    if bmax <= 500:
        return 1000
    if bmax <= 2000:
        return 1500
    return 2000


def _row_to_dict(row: sqlite3.Row | None) -> dict[str, Any] | None:
    if row is None:
        return None
    d = dict(row)
    if d.get("photo_urls"):
        try:
            d["photo_urls"] = json.loads(d["photo_urls"])
        except json.JSONDecodeError:
            d["photo_urls"] = []
    else:
        d["photo_urls"] = []
    return d


def create_artisan(
    name: str,
    phone: str | None = None,
    email: str | None = None,
    telegram_user_id: int | None = None,
    telegram_chat_id: int | None = None,
) -> dict[str, Any]:
    token = secrets.token_urlsafe(32)
    with get_db() as conn:
        cur = conn.execute(
            """
            INSERT INTO artisans (name, phone, email, telegram_user_id, telegram_chat_id, auth_token, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (name, phone, email, telegram_user_id, telegram_chat_id, token, _now()),
        )
        artisan_id = cur.lastrowid
        row = conn.execute("SELECT * FROM artisans WHERE id = ?", (artisan_id,)).fetchone()
    return _row_to_dict(row)  # type: ignore[return-value]


def get_artisan_by_token(token: str) -> dict[str, Any] | None:
    with get_db() as conn:
        row = conn.execute("SELECT * FROM artisans WHERE auth_token = ?", (token,)).fetchone()
    return _row_to_dict(row)


def get_artisan_by_telegram(telegram_user_id: int) -> dict[str, Any] | None:
    with get_db() as conn:
        row = conn.execute(
            "SELECT * FROM artisans WHERE telegram_user_id = ?",
            (telegram_user_id,),
        ).fetchone()
    return _row_to_dict(row)


def get_artisan_by_email(email: str) -> dict[str, Any] | None:
    with get_db() as conn:
        row = conn.execute(
            "SELECT * FROM artisans WHERE LOWER(email) = LOWER(?)",
            (email.strip(),),
        ).fetchone()
    return _row_to_dict(row)


def get_artisan_by_id(artisan_id: int) -> dict[str, Any] | None:
    with get_db() as conn:
        row = conn.execute("SELECT * FROM artisans WHERE id = ?", (artisan_id,)).fetchone()
    return _row_to_dict(row)


def update_artisan_telegram(artisan_id: int, telegram_user_id: int, telegram_chat_id: int) -> None:
    with get_db() as conn:
        conn.execute(
            """
            UPDATE artisans SET telegram_user_id = ?, telegram_chat_id = ?
            WHERE id = ?
            """,
            (telegram_user_id, telegram_chat_id, artisan_id),
        )


def create_lead(
    *,
    client_telegram_id: int | None = None,
    trade_type: str = "Autre",
    location_city: str | None = None,
    location_postal: str | None = None,
    location_address: str | None = None,
    budget_min: int | None = None,
    budget_max: int | None = None,
    urgency: str = "normal",
    description: str | None = None,
    client_name: str | None = None,
    client_phone: str | None = None,
    client_email: str | None = None,
    photo_urls: list[str] | None = None,
) -> int:
    price = compute_lead_price_cents(budget_min, budget_max)
    photos_json = json.dumps(photo_urls or [])
    with get_db() as conn:
        cur = conn.execute(
            """
            INSERT INTO leads (
                client_telegram_id, trade_type, location_city, location_postal, location_address,
                budget_min, budget_max, urgency, description,
                client_name, client_phone, client_email, photo_urls,
                price_cents, status, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'available', ?)
            """,
            (
                client_telegram_id,
                trade_type,
                location_city,
                location_postal,
                location_address,
                budget_min,
                budget_max,
                urgency,
                description,
                client_name,
                client_phone,
                client_email,
                photos_json,
                price,
                _now(),
            ),
        )
        return int(cur.lastrowid)


def append_photos_to_latest_lead(client_telegram_id: int, file_ids: list[str]) -> bool:
    """Ajoute des photos au dernier lead du client (complément Telegram)."""
    with get_db() as conn:
        row = conn.execute(
            """
            SELECT id, photo_urls FROM leads
            WHERE client_telegram_id = ? AND status = 'available'
            ORDER BY id DESC LIMIT 1
            """,
            (client_telegram_id,),
        ).fetchone()
        if not row:
            return False
        photos = json.loads(row["photo_urls"] or "[]")
        for fid in file_ids:
            ref = f"telegram://{fid}"
            if ref not in photos:
                photos.append(ref)
        conn.execute(
            "UPDATE leads SET photo_urls = ? WHERE id = ?",
            (json.dumps(photos), row["id"]),
        )
    return True


def get_lead(lead_id: int) -> dict[str, Any] | None:
    with get_db() as conn:
        row = conn.execute("SELECT * FROM leads WHERE id = ?", (lead_id,)).fetchone()
    return _row_to_dict(row)


def list_available_leads() -> list[dict[str, Any]]:
    with get_db() as conn:
        rows = conn.execute(
            """
            SELECT id, trade_type, location_city, location_postal, budget_min, budget_max,
                   urgency, description, photo_urls, price_cents, status, created_at
            FROM leads WHERE status = 'available'
            ORDER BY
                CASE urgency WHEN 'urgent' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END,
                created_at DESC
            """
        ).fetchall()
    return [_mask_lead_public(_row_to_dict(r)) for r in rows]  # type: ignore[arg-type]


def list_purchased_leads(artisan_id: int) -> list[dict[str, Any]]:
    with get_db() as conn:
        rows = conn.execute(
            """
            SELECT * FROM leads
            WHERE buyer_artisan_id = ? AND status = 'sold'
            ORDER BY sold_at DESC
            """,
            (artisan_id,),
        ).fetchall()
    return [_row_to_dict(r) for r in rows]  # type: ignore[misc]


def _mask_lead_public(lead: dict[str, Any]) -> dict[str, Any]:
    """Masque les coordonnées tant que le lead n'est pas acheté."""
    photos = lead.get("photo_urls") or []
    return {
        "id": lead["id"],
        "trade_type": lead.get("trade_type"),
        "location_city": lead.get("location_city"),
        "location_postal": lead.get("location_postal"),
        "budget_min": lead.get("budget_min"),
        "budget_max": lead.get("budget_max"),
        "budget_label": _budget_label(lead.get("budget_min"), lead.get("budget_max")),
        "urgency": lead.get("urgency"),
        "urgency_label": _urgency_label(lead.get("urgency")),
        "description_preview": _preview(lead.get("description"), 120),
        "photo_count": len(photos),
        "price_cents": lead.get("price_cents"),
        "price_eur": (lead.get("price_cents") or 0) / 100,
        "created_at": lead.get("created_at"),
        "status": lead.get("status"),
    }


def _budget_label(bmin: int | None, bmax: int | None) -> str:
    if bmin is None and bmax is None:
        return "Non précisé"
    if bmax and bmax >= 50000:
        return f"> {bmin or 5000} €"
    if bmin is not None and bmax is not None:
        return f"{bmin} – {bmax} €"
    return str(bmax or bmin or "—")


def _urgency_label(urgency: str | None) -> str:
    return {"urgent": "Urgent", "normal": "Normal", "low": "Pas pressé"}.get(
        urgency or "", urgency or "—"
    )


def _preview(text: str | None, n: int) -> str:
    if not text:
        return ""
    return text if len(text) <= n else text[: n - 1] + "…"


def reserve_lead_for_checkout(lead_id: int, artisan_id: int, stripe_session_id: str) -> bool:
    """Réserve le lead le temps du paiement Stripe."""
    with get_db() as conn:
        cur = conn.execute(
            """
            UPDATE leads
            SET status = 'reserved', buyer_artisan_id = ?, stripe_session_id = ?
            WHERE id = ? AND status = 'available'
            """,
            (artisan_id, stripe_session_id, lead_id),
        )
        return cur.rowcount > 0


def release_reserved_lead(lead_id: int) -> None:
    with get_db() as conn:
        conn.execute(
            """
            UPDATE leads
            SET status = 'available', buyer_artisan_id = NULL, stripe_session_id = NULL
            WHERE id = ? AND status = 'reserved'
            """,
            (lead_id,),
        )


def fulfill_lead_purchase(
    lead_id: int,
    artisan_id: int,
    stripe_payment_intent: str | None = None,
) -> dict[str, Any] | None:
    """Marque le lead comme vendu après paiement confirmé."""
    with get_db() as conn:
        cur = conn.execute(
            """
            UPDATE leads
            SET status = 'sold', sold_at = ?, stripe_payment_intent = ?,
                buyer_artisan_id = ?
            WHERE id = ? AND status IN ('reserved', 'available')
            """,
            (_now(), stripe_payment_intent, artisan_id, lead_id),
        )
        if cur.rowcount == 0:
            row = conn.execute(
                "SELECT * FROM leads WHERE id = ? AND status = 'sold' AND buyer_artisan_id = ?",
                (lead_id, artisan_id),
            ).fetchone()
            return _row_to_dict(row) if row else None
        row = conn.execute("SELECT * FROM leads WHERE id = ?", (lead_id,)).fetchone()
    return _row_to_dict(row)


def get_lead_by_stripe_session(session_id: str) -> dict[str, Any] | None:
    with get_db() as conn:
        row = conn.execute(
            "SELECT * FROM leads WHERE stripe_session_id = ?",
            (session_id,),
        ).fetchone()
    return _row_to_dict(row)


def get_active_subscribers() -> list[int]:
    """Retourne les telegram_chat_id des artisans avec abonnement actif."""
    with get_db() as conn:
        rows = conn.execute(
            "SELECT telegram_chat_id FROM artisans WHERE subscription_active = 1 AND telegram_chat_id IS NOT NULL"
        ).fetchall()
    return [row["telegram_chat_id"] for row in rows]


def update_subscription_status(artisan_id: int, active: bool, stripe_subscription_id: str | None = None) -> None:
    with get_db() as conn:
        if stripe_subscription_id:
            conn.execute(
                "UPDATE artisans SET subscription_active = ?, stripe_subscription_id = ? WHERE id = ?",
                (1 if active else 0, stripe_subscription_id, artisan_id),
            )
        else:
            conn.execute(
                "UPDATE artisans SET subscription_active = ? WHERE id = ?",
                (1 if active else 0, artisan_id),
            )