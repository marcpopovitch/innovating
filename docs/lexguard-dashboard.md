# LexGuard Gov — dashboard

Interface en français, responsive, sans étape de compilation. Elle fonctionne sans clé API ni connexion PostgreSQL. La collecte et l'analyse sont prises en charge par les autres services de l'équipe.

## Lancer

```sh
.venv/bin/python -m pip install fastapi uvicorn
.venv/bin/python -m uvicorn backend.lexguard:app --host 127.0.0.1 --port 8000 --reload
```

Ouvrir http://localhost:8000. L'ancienne API de startups reste dans `backend/main.py` ; `backend/lexguard.py` permet de lancer LexGuard indépendamment de ses dépendances.

## Fonctionnalités

- Synthèse : indicateurs, alertes prioritaires, graphique d'évolution, sources et derniers textes.
- Alertes : filtres par type et niveau, recherche, comparaison de deux dispositions, état examiné, export Markdown et CSV.
- Corpus : recherche, filtre, fiches et export CSV.
- Projets : saisie, consultation, téléchargement et suppression des projets à analyser.
- Sources : état et volume transmis par la collecte.

Le statut examiné et les projets sont conservés dans le stockage local du navigateur. Ils ne sont pas synchronisés entre utilisateurs. L'enregistrement d'un projet ne lance pas d'analyse IA. Aucune donnée juridique n'est envoyée vers un service tiers par cette interface. Les polices Google Fonts sont facultatives ; leur indisponibilité déclenche le repli sur les polices système.

## Branchement du service de collecte

Le frontend appelle `GET /api/lexguard/dashboard`. Deux possibilités : implémenter directement cette route dans le service de collecte, ou publier un snapshot JSON à `data/lexguard.json` pour l'entrée existante. `LEXGUARD_DATA_FILE` permet de modifier le chemin. Publier les snapshots par écriture dans un fichier temporaire puis renommage atomique pour éviter les lectures partielles.

L'interface n'interroge pas directement Aiven et aucun identifiant PostgreSQL n'est exposé au navigateur. Le collecteur peut lire PostgreSQL puis produire le format suivant. Un retour 503 ou un format invalide fait passer explicitement l'interface en démonstration. Une réponse valide avec des tableaux vides affiche un état vide réel, sans exemples injectés.

```json
{
  "mode": "live",
  "updated_at": "2026-10-22T10:00:00Z",
  "stats": {"texts": 1, "analyses": 0, "sources": 1},
  "trend": [{"label": "22 oct.", "detected": 1, "resolved": 0}],
  "sources": [{
    "id": "jo", "name": "Journal officiel",
    "description": "Lois, décrets et arrêtés nationaux",
    "kind": "national", "icon": "landmark", "count": 1,
    "status": "connected"
  }],
  "documents": [{
    "id": "document-1", "title": "Titre du texte collecté",
    "reference": "Référence officielle", "level": "national",
    "domain": "Environnement", "date": "2026-10-22",
    "status": "À examiner", "alerts": 1,
    "content": "Texte intégral fourni par la collecte."
  }],
  "alerts": [{
    "id": "alerte-1", "type": "conflict", "severity": "high",
    "title": "Titre de la détection", "description": "Résumé de la détection.",
    "domain": "Environnement", "level": "national",
    "detected_at": "2026-10-22T09:00:00Z", "status": "new",
    "texts": [
      {"title": "Texte A", "reference": "Article concerné", "excerpt": "Extrait exact du texte A."},
      {"title": "Texte B", "reference": "Article concerné", "excerpt": "Extrait exact du texte B."}
    ],
    "reason": "Explication sourcée de l'incohérence potentielle.",
    "recommendation": "Piste d'examen à vérifier par un juriste."
  }]
}
```

Valeurs attendues :

| Champ | Valeurs |
|---|---|
| `alerts[].type` | `conflict`, `duplicate`, `gap` |
| `alerts[].severity` | `critical`, `high`, `medium`, `low` |
| `level` | `european`, `national`, `ministerial`, `local` |
| `sources[].status` | `connected`, `pending`, `error` |
| `alerts[].status` | `new`, `reviewed` |
| `sources[].icon` | `landmark`, `globe`, `book` |

`confidence` est un nombre facultatif entre 0 et 100, présenté comme score du détecteur et jamais comme certitude juridique. Les textes de démonstration sont fictifs et signalés comme tels. Les indicateurs agrégés peuvent couvrir un corpus plus large que les listes ; les compteurs de listes correspondent aux éléments effectivement retournés. `stats.analyses` désigne les analyses terminées par le service, pas les projets locaux en attente.

Les chaînes reçues sont échappées avant affichage. Les exports CSV neutralisent les cellules qui pourraient être interprétées comme des formules. Le dashboard actuel ne modifie pas la base PostgreSQL.

## Cadrage de l'analyse

Dans « Nouvelle analyse », ouvrir **Options de cadrage**. Les six options sont facultatives. Le niveau de lecture (débutant à expert) est distinct du niveau normatif du projet. Les projets existants restent lisibles et les enregistrements sans options conservent le parcours local précédent.

`agent/analysis.py` définit les modèles Pydantic `AnalysisOptions`, `SearchRequest`, `SearchFilters` et `SearchConstraints`. Les valeurs par défaut sont : aucun domaine imposé, niveau et résultat sans préférence, toutes périodes, aucune restriction de langue, listes de mots-clés vides. « Français et anglais » impose explicitement ces deux langues ; ne rien sélectionner préserve le comportement antérieur. « Autre » exige une précision de domaine. Chaque liste accepte 20 mots-clés maximum de 100 caractères chacun. Une inclusion et une exclusion identiques (sans tenir compte de la casse) sont refusées. Les champs inconnus et valeurs hors des choix autorisés renvoient HTTP 422.

Préparer une recherche sans l'exécuter : `POST /api/lexguard/analysis` :

```json
{
  "text": "Comparer les obligations de conservation des données de santé",
  "options": {
    "domains": ["droit", "santé"],
    "level": "expert",
    "result_type": "comparatif",
    "period": "5y",
    "source_language": "both",
    "include_keywords": ["RGPD"],
    "exclude_keywords": ["publicité"]
  }
}
```

La réponse contient `text` (original), `query` (chaîne compatible avec les outils existants), `keywords`, `filters` (`domains`, `published_after`, `source_languages`) et `constraints` (`level`, `result_type`, inclusions/exclusions). Les mots-clés sont extraits par tokenisation déterministe, sans appel LLM. La période utilise une date glissante calendaire, avec prise en charge du 29 février.

Le formulaire enregistre ces critères et la requête structurée avec le projet, consultables et téléchargeables ensuite. Le service de recherche LexGuard reste à brancher : aucune recherche n'est simulée. Si la validation échoue ou que l'API est inaccessible, le formulaire conserve la saisie et affiche l'erreur.

Dans l'API historique, `POST /chat` accepte le même objet `options` à côté de `startup_id` et `message`. Le flux devient : demande + options → `prepare_analysis` → prompt structuré → adaptateurs des arguments de `search_knowledge` et `web_search` → fonctions de recherche existantes. Sans options (ou avec les valeurs par défaut), prompt et handlers restent identiques. L'historique conserve la demande originale. La route historique `/analyze/{startup_id}`, qui analyse une fiche d'entreprise et non une demande libre, reste inchangée.

Les moteurs existants acceptent uniquement une chaîne : dates, langues et exclusions sont donc transmises sous forme de critères dans cette chaîne et dans le cadrage du modèle, sans garantie de filtrage strict. `agent/tools.py`, `agent/sources.py` et `backend/db.py` restent inchangés. Aucun nouveau paquet n'est requis : Pydantic est déjà utilisé par FastAPI et l'API existante.

Tests sans clés ni accès externe :

```sh
.venv/bin/python -m unittest discover -s tests -v
```
