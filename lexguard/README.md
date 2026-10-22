# Ciceron

**Chaque arrêté vérifié contre tout le droit en vigueur, avant signature.**

Ciceron aide les mairies et les préfectures (contrôle de légalité) à repérer, dans un acte local ou dans un texte qui vient de paraître au Journal officiel, les **conflits de normes**, **incompétences**, **doublons** et **vides juridiques**. Chaque alerte cite l'article exact, en vigueur, avec un extrait vérifié mot pour mot, et renvoie vers Légifrance.

Projet du hackathon AI Innovate Paris (22/10/2026, Accel × Iterate).

## Les données

| Source | Rôle | Accès |
|---|---|---|
| Dump DILA **LEGI** + incréments quotidiens | 9 codes utiles aux collectivités (CGCT, rural, route, santé publique, environnement, urbanisme, sécurité intérieure, pénal, CRPA), **toutes versions datées** + graphe des liens | Open data, sans clé |
| Incréments quotidiens DILA **JORF** | Flux des textes parus au Journal officiel | Open data, sans clé |
| Actes des collectivités au format **SCDL** | Mémoire : 18 000+ actes réels (Grand Paris Sud, Évry-Courcouronnes, Issy-les-Moulineaux), 14 000 en texte intégral | data.gouv, sans clé |
| **EUR-Lex** | Actes de l'UE cités | Lecture par CELEX |

## Les agents

```
acte ──► Analyste (découpe en dispositions)
           │
           ├──► Chercheur d1 ─┐  plusieurs étapes, outils SQL :
           ├──► Chercheur d2 ─┤  search_corpus · get_article · follow_links
           └──► Chercheur dN ─┘  search_jo · search_local_acts · fetch_eu_act
                     │
                     ▼
                  Juge (Opus) ◄── doctrine interne : retours des juristes
                     │
                     ▼
        Contradicteur (Opus) + contrôles en code
        (article existant, en vigueur à la date de l'acte, extrait exact)
                     │
                     ▼
                  Rédacteur ──► alertes vérifiées + rédaction corrigée
```

La **veille** croise chaque nouveau texte du JO avec les actes stockés des collectivités (même article du même code, même sujet), puis un agent confirme l'impact.

## Commandes

```bash
npm install
npm run ingest:legi -- .data/dila/legi_global.tar.gz all   # corpus (dump DILA + incréments)
npm run ingest:actes                                        # actes des collectivités
npm run veille -- 2                                         # JO récents + impacts
npm run dev                                                 # http://localhost:3000
npm test                                                    # vitest (agents simulés, base en mémoire)
npm run bench                                               # avant/après sur bench/cases.json (clé requise)
npm run data-layer > bench/data-layer.txt                   # livrable « data layer in action »
npm run sql -- "select count(*) from articles"
```

Variables d'environnement (à mettre dans `.env`) : `OPENAI_API_KEY` (modèles GPT, en direct), `OPENROUTER_API_KEY` (Claude, Mistral, Gemini — et GPT si pas de clé OpenAI) ou à défaut `ANTHROPIC_API_KEY` (Claude seulement) ; `DATABASE_URL` (Aiven PostgreSQL ; sans elle, base PGlite locale dans `.data/pglite`).

PGlite n'accepte qu'un processus à la fois : arrêter `npm run dev` avant de lancer un script d'ingestion en local.

## Déploiement Aiven

1. Créer un service **Aiven for PostgreSQL** (au moins 8 Go de disque : le corpus complet, jurisprudence comprise, pèse quelques Go) et mettre son *Service URI* dans `.env` comme `DATABASE_URL`.
2. Arrêter `npm run dev`, puis copier la base locale vers Aiven : `npm run migrate:aiven`. Le schéma est créé tout seul.
3. Relancer `npm run dev` : l'application lit désormais Aiven.
3. Déployer le conteneur (`Dockerfile`, port 8080) sur **Aiven Runtime** avec `ANTHROPIC_API_KEY` et `DATABASE_URL`.

## Déploiement Modal + Keenable (IA en prod)

Les agents **Python** (`agents/`, à la racine du dépôt) tournent en service autonome sur **Modal** (compute serverless) et récupèrent les textes de loi via **Keenable** (recherche web + fetch du vrai texte sur Légifrance / EUR-Lex) — aucun Postgres requis de ce côté. L'app Next.js les appelle via le bouton **« Analyser via Modal ⚡ »** de `/app/analyse` (chemin parallèle ; le moteur TS de prod reste inchangé).

```bash
# 1. Connexion (une fois) — depuis la RACINE du dépôt
pip install modal
python3 -m modal setup                       # auth navigateur

# 2. Secret (pas de fichier .env : l'écriture de .env* est bloquée par un hook)
#    ANTHROPIC_API_KEY : clé Anthropic RÉELLE (le helper local ne vaut pas à distance)
#    KEENABLE_API_KEY  : optionnel (keyless marche ; la clé lève le throttling)
modal secret create ciceron ANTHROPIC_API_KEY=sk-ant-... KEENABLE_API_KEY=keen_...

# 3. Vérifier, servir, déployer
modal run    get_started.py        # smoke-test d'auth -> « the square is 1764 »
modal serve  agents/modal_app.py   # URL temporaire (dev)
modal deploy agents/modal_app.py   # URL stable (prod)
```

Mettre l'URL renvoyée par `modal deploy` dans la variable d'environnement **`MODAL_AGENTS_URL`** de l'app Next.js (injectée au déploiement, pas dans un `.env`). Sans elle, la route `POST /api/analyses/modal` répond 503 et le bouton reste inactif.

Réglages (variables d'env du service, optionnelles) : `CHECK_TIMEOUT_S` (défaut 60, ~90 conseillé pour les fetch web), `SEARCH_MAX_RESULTS`, `SEARCH_TEXT_MAX_CHARS`, `CICERON_SEARCH_BACKEND=mock` (force le corpus mock `data/mock_articles.json`).
