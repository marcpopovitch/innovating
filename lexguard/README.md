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

Variables d'environnement (à mettre dans `.env`) : `OPENROUTER_API_KEY` (une clé pour tous les modèles : Claude, GPT, Mistral, Gemini) ou à défaut `ANTHROPIC_API_KEY` (Claude seulement) ; `DATABASE_URL` (Aiven PostgreSQL ; sans elle, base PGlite locale dans `.data/pglite`).

PGlite n'accepte qu'un processus à la fois : arrêter `npm run dev` avant de lancer un script d'ingestion en local.

## Déploiement Aiven

1. Créer un service **Aiven for PostgreSQL** (au moins 8 Go de disque : le corpus complet, jurisprudence comprise, pèse quelques Go) et mettre son *Service URI* dans `.env` comme `DATABASE_URL`.
2. Arrêter `npm run dev`, puis copier la base locale vers Aiven : `npm run migrate:aiven`. Le schéma est créé tout seul.
3. Relancer `npm run dev` : l'application lit désormais Aiven.
3. Déployer le conteneur (`Dockerfile`, port 8080) sur **Aiven Runtime** avec `ANTHROPIC_API_KEY` et `DATABASE_URL`.
