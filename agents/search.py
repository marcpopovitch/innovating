"""Recherche d'articles. MOCK : mots-clés sur data/mock_articles.json.

Un coéquipier la remplacera par la vraie recherche (Aiven OpenSearch / PostgreSQL).
Garder EXACTEMENT la signature et le format de sortie :
    {"id", "ref", "level", "version_date", "url", "text"}
level ∈ constitution | international | loi | décret | arrêté | jurisprudence
"""
import json
import re
import unicodedata
from functools import lru_cache

from agents.config import ROOT
from agents.schemas import LEVELS

STOPWORDS = {"les", "des", "une", "par", "pour", "sur", "est", "dans", "aux", "qui", "que", "avec", "son", "ses",
             "leur", "doit", "être", "ete", "etre", "pas", "plus", "the", "and", "ou", "du", "de", "la", "le", "en"}

# Article de code : L = partie législative, R ou D = partie réglementaire (ex. "art. R412-43-1", "L. 2212-2").
_CODE_ARTICLE = re.compile(r"\b([LRD])\.?\s?\d+(?:-\d+)*\b")


def _norm(text: str) -> str:
    text = unicodedata.normalize("NFKD", text.replace("’", "'")).encode("ascii", "ignore").decode()
    return text.lower()


def _terms(text: str) -> set[str]:
    return {w for w in re.findall(r"[a-z0-9]+", _norm(text)) if len(w) > 2 and w not in STOPWORDS}


def infer_level(ref: str) -> str | None:
    """Niveau déduit de la référence d'un article de code : L -> loi, R ou D -> décret. Sinon None."""
    match = _CODE_ARTICLE.search(ref or "")
    if not match:
        return None
    return "loi" if match.group(1) == "L" else "décret"


# Valeurs de filtre acceptées, sans accents ni majuscules ("decret" -> "décret", "UE" -> "international").
_LEVEL_ALIASES = {_norm(level): level for level in LEVELS} | {"ue": "international"}


def _normalize_level(value) -> str | None:
    return _LEVEL_ALIASES.get(_norm(str(value))) if value else None


@lru_cache(maxsize=1)
def _articles() -> list[dict]:
    rows = json.loads((ROOT / "data" / "mock_articles.json").read_text(encoding="utf-8"))
    out = []
    for a in rows:
        # Les emplacements dont le texte n'a pas encore été collé ("TODO") sont ignorés.
        if not a["text"].strip() or a["text"].strip() == "TODO":
            continue
        a = dict(a)
        a["level"] = a.get("level") or infer_level(a["ref"])
        out.append(a)
    return out


def search_articles(query: str, filters: dict | None = None) -> list[dict]:
    """Articles classés par nombre de termes de la requête présents dans la référence + le texte."""
    q = _terms(query)
    wanted_level = _normalize_level((filters or {}).get("level"))  # valeur inconnue -> filtre ignoré
    scored = []
    for a in _articles():
        if wanted_level and a["level"] != wanted_level:
            continue
        score = len(q & _terms(a["ref"] + " " + a["text"]))
        if score:
            scored.append((score, a))
    scored.sort(key=lambda x: -x[0])
    return [dict(a) for _, a in scored[:8]]


if __name__ == "__main__":
    for r in search_articles("vitesse maximale engin de déplacement personnel motorisé"):
        print(r["level"], "|", r["ref"])
