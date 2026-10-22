"""Outils donnés à Claude. Une Toolbox par startup (et par pod pour l'analyse).

Garde-fou anti-hallucination : save_fact n'accepte qu'une URL déjà renvoyée
par un outil pendant cette session (base ou web). Pas de source, pas de fait.
"""
from datetime import timedelta

from agent import sources
from backend import db
from backend.config import FACT_MAX_AGE_DAYS

TOOL_DEFS = {
    "get_startup_profile": {
        "name": "get_startup_profile",
        "description": "Fiche de la startup en base (nom, site, secteur, pays, description, financement...).",
        "input_schema": {"type": "object", "properties": {}, "required": []},
    },
    "get_stored_facts": {
        "name": "get_stored_facts",
        "description": "Faits sourcés déjà enregistrés sur la startup. 'stale' = trop ancien, à revérifier.",
        "input_schema": {
            "type": "object",
            "properties": {"pod": {"type": "string", "enum": db.PODS,
                                   "description": "Filtrer sur un pod (optionnel)."}},
            "required": [],
        },
    },
    "search_knowledge": {
        "name": "search_knowledge",
        "description": "Recherche dans les textes déjà stockés en base (pages web récupérées précédemment). "
                       "À utiliser AVANT la recherche web.",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string"},
                "scope": {"type": "string", "enum": ["startup", "sector"],
                          "description": "'startup' = cette startup, 'sector' = tout son secteur."},
            },
            "required": ["query"],
        },
    },
    "web_search": {
        "name": "web_search",
        "description": "Recherche web (Keenable). Seulement si la base ne suffit pas. "
                       "Les résultats sont stockés en base avec leur date de récupération.",
        "input_schema": {"type": "object", "properties": {"query": {"type": "string"}}, "required": ["query"]},
    },
    "save_fact": {
        "name": "save_fact",
        "description": "Enregistre UN fait court et vérifiable, avec l'URL exacte de la source "
                       "(qui doit apparaître dans un résultat d'outil).",
        "input_schema": {
            "type": "object",
            "properties": {
                "content": {"type": "string", "description": "Une phrase factuelle, autonome, en français."},
                "source_url": {"type": "string"},
            },
            "required": ["content", "source_url"],
        },
    },
}


def profile_source(startup: dict) -> str:
    """'URL' de provenance de la fiche startup elle-même."""
    if startup.get("data_source") == "harmonic":
        return f"https://api.harmonic.ai/companies/{startup['id']}"
    return startup.get("website") or f"{startup.get('data_source')}:{startup['id']}"


class Toolbox:
    def __init__(self, startup: dict, pod: str | None = None):
        self.startup = startup
        self.pod = pod
        self.seen: dict[str, object] = {}  # url -> fetched_at, tout ce que Claude a pu lire

    def definitions(self, names: list[str]) -> list[dict]:
        return [TOOL_DEFS[n] for n in names]

    def handlers(self, names: list[str]) -> dict:
        return {n: getattr(self, n) for n in names}

    # -- outils
    def get_startup_profile(self) -> dict:
        url = profile_source(self.startup)
        fetched_at = self.startup.get("fetched_at") or db.now()
        self.seen[url] = fetched_at
        return {**{k: self.startup.get(k) for k in db.STARTUP_FIELDS}, "source_url": url, "fetched_at": fetched_at}

    def get_stored_facts(self, pod: str | None = None) -> list[dict]:
        limit = db.now() - timedelta(days=FACT_MAX_AGE_DAYS)
        facts = db.get_facts(self.startup["id"], pod)
        for f in facts:
            self.seen[f["source_url"]] = f["fetched_at"]
            f["stale"] = f["fetched_at"] < limit
        return facts

    def search_knowledge(self, query: str, scope: str = "startup") -> list[dict]:
        if scope == "sector":
            rows = db.search_chunks(query, sector=self.startup.get("sector"))
        else:
            rows = db.search_chunks(query, startup_id=self.startup["id"])
        for r in rows:
            self.seen[r["url"]] = r["fetched_at"]
        return rows or [{"info": "Rien en base pour cette requête."}]

    def web_search(self, query: str) -> list[dict]:
        results = sources.web_search(query)
        for r in results:
            r["fetched_at"] = db.add_source(r["url"], r["title"], r["snippet"], self.startup["id"])
            self.seen[r["url"]] = r["fetched_at"]
        return results or [{"info": "Aucun résultat web."}]

    def save_fact(self, content: str, source_url: str) -> str:
        if not self.pod:
            raise ValueError("save_fact n'est disponible que pendant l'analyse d'un pod")
        if source_url not in self.seen:
            raise ValueError("source_url inconnue : cite une URL renvoyée par un outil")
        db.add_fact(self.startup["id"], self.pod, content.strip(), source_url, self.seen[source_url])
        return "ok"
