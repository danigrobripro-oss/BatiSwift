# BâtiSwift AI — routes des modules et configuration

Toutes les routes sont sous `/api/ai`, protégées par `@require_artisan` (JWT) puis `@require_ai_module(<module>)`
(abonnement actif en base). Corps JSON sauf mention « multipart ». Erreurs : `{"error": "..."}` (400 validation, 403 abonnement,
404 introuvable ou appartenant à un autre artisan, 502 service IA/messagerie, 500 interne).

| Module | Méthode et chemin | Rôle |
|---|---|---|
| qualification | POST `/qualification/analyze` (multipart : `fichier`, `texte`, `titre`) | analyse + enregistrement |
| | GET `/qualification/analyses`, GET/DELETE `/qualification/analyses/<id>` | historique |
| chantier | GET/POST `/chantier/sites`, PUT `/chantier/sites/<id>` | chantiers |
| | GET/POST `/chantier/sites/<id>/entries` (POST multipart : `kind` note/photo/audio, `texte`, `fichier`) | journal |
| | DELETE `/chantier/entries/<id>` ; POST `/chantier/sites/<id>/report` `{date_debut,date_fin}` | compte rendu |
| achats | GET/POST `/achats/sites`, PUT `/achats/sites/<id>` (`budget_achats`, `prix_vente_ht` en €) | chantiers et budgets |
| | POST `/achats/invoices/analyze` (multipart : `fichier`, `chantier_id`) ; GET `/achats/invoices?chantier_id=` | factures |
| | PUT/DELETE `/achats/invoices/<id>` ; GET `/achats/summary` | correction, synthèse prévu/réel |
| travaux_sup | GET `/travaux_sup/sources` ; POST `/travaux_sup/analyze` `{titre,devis_text,quote_analysis_id,constat_text}` | comparaison |
| | GET/DELETE `/travaux_sup/analyses[/<id>]` ; POST/PUT `/travaux_sup/analyses/<id>/avenant` | projet d'avenant |
| coordination | GET `/coordination/overview` ; POST `/coordination/followups` ; PUT/DELETE `/coordination/followups/<id>` | actions |
| | GET `/coordination/followups/<id>/logs` ; POST `/coordination/draft` ; POST `/coordination/send` (`confirm: true` obligatoire) | messages |

Tables créées (additives) : `ai_quote_analyses`, `ai_chantiers`, `ai_chantier_entries`, `ai_invoices`, `ai_extra_works`,
`ai_followups`, `ai_followup_logs`. Montants en centimes (entiers). Aucune table existante modifiée.

Variables d'environnement : aucune nouvelle obligatoire. Réutilisées : `GEMINI_API_KEY`, `GEMINI_MODEL` (le modèle doit accepter
PDF, images et audio), `INFOBIP_*`, `BREVO_*`. Optionnelle : `AI_QUOTA_PER_HOUR` (défaut 40 analyses IA par artisan et par heure, par processus).
