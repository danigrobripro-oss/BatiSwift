#!/bin/bash
# BâtiSwift — Démarrage local (avec gestion des variables d'environnement)

set -e  # Arrête le script en cas d'erreur

echo "🚀 BâtiSwift — Démarrage du backend..."

# ─── 1. Charger les variables d'environnement ──────────────
if [ -f .env ]; then
    echo "📄 Chargement du fichier .env..."
    export $(grep -v '^#' .env | xargs)
else
    echo "⚠️  Fichier .env manquant. Création d'un fichier par défaut..."
    cat > .env << EOF
# BâtiSwift — Variables d'environnement (local)
FLASK_ENV=development
FLASK_DEBUG=1
PORT=8000
SECRET_KEY=dev-secret-key-change-in-prod
JWT_SECRET=dev-jwt-secret-change-in-prod

# ─── Services externes (à remplacer par vos clés) ──────────
GEMINI_API_KEY=ta_clé_gemini
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
INFOBIP_API_KEY=ta_clé_infobip
INFOBIP_BASE_URL=https://api.infobip.com
BREVO_API_KEY=ta_clé_brevo
BREVO_SENDER_EMAIL=noreply@batiswift.fr
BREVO_SENDER_NAME=BâtiSwift
DEEPL_API_KEY=ta_clé_deepl

# ─── Base de données (local) ───────────────────────────────
DATABASE_URL=sqlite:///batiswift.db

# ─── Frontend (pour les notifications) ─────────────────────
FRONTEND_URL=http://localhost:5500
EOF
    echo "✅ Fichier .env créé. Modifiez-le avec vos vraies clés."
fi

# ─── 2. Vérifier et installer les dépendances ──────────────
if [ ! -d "venv" ]; then
    echo "🔧 Création de l'environnement virtuel..."
    python3 -m venv venv
fi

echo "📦 Activation de l'environnement virtuel..."
source venv/bin/activate

echo "📦 Installation des dépendances..."
pip install -r requirements.txt > /dev/null 2>&1 || pip install -r requirements.txt

# ─── 3. Démarrer l'application ──────────────────────────────
echo "🔥 Lancement du serveur Flask..."
echo "   API : http://localhost:8000"
echo "   Site : ouvrir index.html avec Live Server (port 5500)"
echo ""
python agent.py