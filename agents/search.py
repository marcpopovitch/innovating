"""Recherche d'articles. MOCK : mots-clés sur data/mock_articles.json.

Un coéquipier la remplacera par la vraie recherche (Aiven OpenSearch / PostgreSQL).
Garder EXACTEMENT la signature et le format de sortie :
    {"id", "ref", "level", "version_date", "url", "text"}
"""
import json
import re
import unicodedata
from functools import lru_cache

from agents.config import ROOT

STOPWORDS = {"les", "des", "une", "par", "pour", "sur", "est", "dans", "aux", "qui", "que", "avec", "son", "ses",
             "leur", "doit", "être", "ete", "etre", "pas", "plus", "the", "and", "ou", "du", "de", "la", "le", "en"}


def _norm(text: str) -> str:
    text = unicodedata.normalize("NFKD", text.replace("’", "'")).encode("ascii", "ignore").decode()
    return text.lower()


def _terms(text: str) -> set[str]:
    return {w for w in re.findall(r"[a-z0-9]+", _norm(text)) if len(w) > 2 and w not in STOPWORDS}


@lru_cache(maxsize=1)
def _articles() -> list[dict]:
    rows = json.loads((ROOT / "data" / "mock_articles.json").read_text(encoding="utf-8"))
    # Les articles dont le texte n'a pas encore été collé ("TODO") sont ignorés.
    return [a for a in rows if a["text"].strip() and a["text"].strip() != "TODO"]


def search_articles(query: str, filters: dict | None = None) -> list[dict]:
    """Articles classés par nombre de termes de la requête présents dans la référence + le texte."""
    q = _terms(query)
    scored = []
    for a in _articles():
        if filters and any(a.get(k) != v for k, v in filters.items() if v):
            continue
        score = len(q & _terms(a["ref"] + " " + a["text"]))
        if score:
            scored.append((score, a))
    scored.sort(key=lambda x: -x[0])
    return [dict(a) for _, a in scored[:8]]


if __name__ == "__main__":
    for r in search_articles("vitesse maximale engin de déplacement personnel motorisé"):
        print(r["ref"])
