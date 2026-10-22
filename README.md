# [NOM] — l'analyste IA des associates VC

Explorer un marché, cliquer sur une startup, obtenir en 2 minutes un dashboard
**Marché / Équipe / Produit / ICP** où **chaque affirmation a sa source** (URL + date),
puis discuter avec l'analyste et exporter un mémo sourcé.

**Parcours de démo**
1. **Explorer** : treemap des startups par secteur (filtre région, recherche), données Harmonic.
2. **Clic sur une startup** (ou coller une URL / un LinkedIn de founder) → 4 sous-agents remplissent les 4 pods.
3. **Chat** : réponses ancrées dans la base, avec sources ; « je ne sais pas » quand c'est le cas.
4. **Export** du mémo sourcé (Markdown / HTML).

## Démarrage en 5 commandes

```bash
git clone https://github.com/marcpopovitch/innovating.git && cd innovating
python -m venv .venv && source .venv/bin/activate     # Windows : .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                                   # puis remplir les clés dans .env
uvicorn backend.main:app --reload                      # → http://localhost:8000
```

- Python **3.11**.
- **Sans `DATABASE_URL`**, l'app tourne en mémoire avec l'échantillon de secours
  [data/sample_startups.json](data/sample_startups.json). C'est suffisant pour développer le front.
- **Avec Aiven** : remplir `DATABASE_URL`, puis `python -m data.load_harmonic --init`
  (crée les tables et charge Harmonic, ou l'échantillon si Harmonic ne répond pas).
- **Éval** : `python -m eval.run_eval` (`--limit 3` pour un test rapide).
- Vérifier l'état : http://localhost:8000/health (stockage utilisé, clés présentes ou non).

## Structure

| Dossier | Contenu |
|---|---|
| [backend/](backend/) | API FastAPI (`main.py`), accès base (`db.py`), config, embeddings, export du mémo |
| [agent/](agent/) | Orchestrateur, sous-agents par pod, outils, chat, boucle Claude, clients Harmonic / Keenable |
| [data/](data/) | `schema.sql` commenté, `load_harmonic.py` (avec cache), échantillon JSON de secours |
| [frontend/](frontend/) | Une page HTML/JS + Plotly servie par FastAPI : vues Explorer et Analyste |
| [eval/](eval/) | `cases.json` + `run_eval.py` : Claude seul vs notre analyste |
| [docs/](docs/) | [architecture.md](docs/architecture.md) |

## API

| Route | Rôle |
|---|---|
| `GET /health` | État de l'app, du stockage et des clés |
| `GET /startups?region=&q=` | Liste pour l'Explorer |
| `GET /startups/{id}` | Dashboard déjà en base (sans relancer d'analyse) |
| `POST /resolve` `{url}` | URL de site / LinkedIn → startup en base |
| `POST /analyze/{id}?refresh=false` | Lance les 4 sous-agents, renvoie le dashboard |
| `POST /chat` `{startup_id, message}` | Question → réponse sourcée |
| `GET /memo/{id}?format=md\|html` | Export du mémo |

## Rôles (5 personnes)

Chacun travaille surtout dans ses fichiers, ce qui limite les conflits Git.

| Rôle | Fichiers | Premières tâches |
|---|---|---|
| **Data / Harmonic** | `data/`, `agent/sources.py`, `backend/db.py` | Vérifier les endpoints Harmonic et le format des réponses (`normalize_company`), créer la base Aiven + pgvector, charger l'échantillon |
| **Agent 1** | `agent/orchestrator.py`, `agent/pods.py`, `agent/llm.py` | Prompts Marché et Équipe, qualité des faits, temps d'analyse |
| **Agent 2** | `agent/chat.py`, `agent/tools.py`, `backend/memo.py` | Prompts Produit et ICP, chat sourcé, mémo (slides en bonus) |
| **Front** | `frontend/` | Rendre la démo belle et fluide (treemap, pods, chat, états de chargement) |
| **Éval + pitch** | `eval/`, `docs/`, slides | Enrichir `cases.json`, lancer l'éval, chiffres pour le pitch, trouver le [NOM] |

## Règles d'équipe

- **Jamais de clé ou de secret dans le code ni dans un commit.** Tout passe par `.env` (ignoré par Git).
- Une branche par tâche (`feature/...`, `fix/...`), puis une Pull Request vers `main`.
- `git pull` souvent. `main` doit toujours démarrer.

## Déploiement (Aiven Runtime)

`Dockerfile` à la racine. Toute la config passe par les variables d'environnement :
`ANTHROPIC_API_KEY`, `HARMONIC_API_KEY`, `KEENABLE_API_KEY`, `DATABASE_URL`
(et `PORT` si la plateforme l'impose ; 8000 par défaut).

## À vérifier en priorité

- **Harmonic** : les chemins (`/search/search_agent`, `/companies`, `/persons`), l'en-tête `apikey` et
  le format des réponses ne sont pas confirmés. À valider avec la doc officielle et une vraie clé.
- **Keenable** : `POST https://api.keenable.ai/v1/search` avec l'en-tête `X-API-Key` ; le format de la
  réponse est lu de façon défensive dans `agent/sources.py`.
- **Modèle Claude** : `claude-opus-5-5` par défaut (`CLAUDE_MODEL`, `CLAUDE_EFFORT` dans `.env`).
