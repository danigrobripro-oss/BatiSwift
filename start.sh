#!/bin/bash
# Démarre le bot Telegram en arrière-plan + l'API Flask (Render / local)
set -e
python agent.py &
exec gunicorn app:app --bind "0.0.0.0:${PORT:-5000}" --workers 2 --timeout 120
