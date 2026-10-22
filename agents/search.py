"""Recherche d'articles de loi via Keenable (recherche web + fetch du VRAI texte).

Keenable (https://keenable.ai) cherche sur le web et récupère la page en Markdown. On le
scope sur Légifrance (droit français) et EUR-Lex (droit de l'UE) pour ne manipuler que des
textes réels et citables. Le contrat de sortie reste EXACTEMENT celui attendu par le
chercheur, le juge et le garde-fou anti-hallucination :
    {"id", "ref", "level", "version_date", "url", "text"}
level ∈ constitution | international | loi | décret | arrêté | jurisprudence

Garde-fou : comme `text` et `url` proviennent de la page réellement récupérée, le contrôle
de `agents/validation.py` (l'extrait cité doit être mot pour mot dans `text`) suffit à garantir
l'absence d'hallucination. Aucune modification de validation.py n'est nécessaire.

Repli : si Keenable est indisponible (réseau, quota) ou ne renvoie rien d'exploitable, on
retombe sur le mock `data/mock_articles.json` pour que le dév local et la démo ne cassent jamais
(mettre CICERON_SEARCH_BACKEND=mock pour forcer le mock).
"""
from __future__ import annotations

import asyncio
import json
import os
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


# ---------------------------------------------------------------------------
# Backend Keenable : recherche web + fetch du vrai texte.
# ---------------------------------------------------------------------------
LEGIFRANCE_SITE = "legifrance.gouv.fr"
EURLEX_SITE = "eur-lex.europa.eu"
MAX_RESULTS = int(os.getenv("SEARCH_MAX_RESULTS", "5"))            # pages récupérées par recherche
FETCH_CONCURRENCY = int(os.getenv("SEARCH_FETCH_CONCURRENCY", "6"))
TEXT_MAX_CHARS = int(os.getenv("SEARCH_TEXT_MAX_CHARS", "5000"))

# Obligation / requête qui relève du droit de l'UE -> on cherche sur EUR-Lex plutôt que Légifrance.
_EU_HINT = re.compile(r"\b(directive|r[eè]glement|union europ[ée]enne|eur-?lex|celex|communautaire|UE)\b", re.I)

_aclient = None           # AsyncKeenable (singleton par process/conteneur)
_fetch_sem = None         # borne la concurrence des fetch
_page_cache: dict[str, dict | None] = {}   # url -> article (ou None si échec) ; dédoublonne entre obligations


def _client():
    global _aclient
    if _aclient is None:
        from keenable import AsyncKeenable
        _aclient = AsyncKeenable(api_key=os.getenv("KEENABLE_API_KEY"))  # None -> keyless
    return _aclient


def _sem() -> asyncio.Semaphore:
    global _fetch_sem
    if _fetch_sem is None:
        _fetch_sem = asyncio.Semaphore(FETCH_CONCURRENCY)
    return _fetch_sem


def _looks_like_article(url: str, title: str) -> bool:
    """Garder les pages d'ARTICLE individuel (citables), pas les pages de section/sommaire."""
    return "/article_lc/" in url or (title or "").strip().lower().startswith("article") or EURLEX_SITE in url


def _level_for(url: str, ref: str) -> str | None:
    return "international" if EURLEX_SITE in url else infer_level(ref)


async def _fetch_article(url: str) -> dict | None:
    """Récupère une page et la met au format article. Résultat mis en cache (y c. les échecs)."""
    if url in _page_cache:
        return _page_cache[url]
    try:
        async with _sem():
            page = await _client().fetch(url)
    except Exception:
        _page_cache[url] = None
        return None
    ref = (page.title or url).strip()
    text = (page.content or "")[:TEXT_MAX_CHARS]
    if not text.strip():
        _page_cache[url] = None
        return None
    art = {"id": page.url or url, "ref": ref, "level": _level_for(page.url or url, ref),
           "version_date": page.published_at or "", "url": page.url or url, "text": text}
    _page_cache[url] = art
    return art


async def _keenable_search(query: str) -> list[dict]:
    site = EURLEX_SITE if _EU_HINT.search(query) else LEGIFRANCE_SITE
    resp = await _client().search(query, site=site)
    results = [r for r in resp if _looks_like_article(r.url, r.title)][:MAX_RESULTS]
    if not results:  # aucun article identifiable : prendre quand même les premiers résultats
        results = list(resp)[:MAX_RESULTS]
    fetched = await asyncio.gather(*[_fetch_article(r.url) for r in results])
    out, seen = [], set()   # dédoublonner par ref (clé du garde-fou), en gardant l'ordre de pertinence
    for a in fetched:
        if a and a["ref"] not in seen:
            seen.add(a["ref"])
            out.append(a)
    return out


# ---------------------------------------------------------------------------
# Repli mock : mots-clés sur data/mock_articles.json (comportement historique).
# ---------------------------------------------------------------------------
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


def _mock_search_articles(query: str) -> list[dict]:
    """Articles classés par nombre de termes de la requête présents dans la référence + le texte."""
    q = _terms(query)
    scored = []
    for a in _articles():
        score = len(q & _terms(a["ref"] + " " + a["text"]))
        if score:
            scored.append((score, a))
    scored.sort(key=lambda x: -x[0])
    return [dict(a) for _, a in scored]


async def search_articles(query: str, filters: dict | None = None) -> list[dict]:
    """Articles réels récupérés via Keenable (repli mock). Contrat de sortie inchangé."""
    wanted_level = _normalize_level((filters or {}).get("level"))  # valeur inconnue -> filtre ignoré
    articles: list[dict] = []
    if os.getenv("CICERON_SEARCH_BACKEND", "keenable").lower() != "mock":
        try:
            articles = await _keenable_search(query)
        except Exception:
            articles = []
    if not articles:
        articles = _mock_search_articles(query)
    if wanted_level:
        articles = [a for a in articles if a["level"] == wanted_level]
    return articles[:8]


if __name__ == "__main__":
    for r in asyncio.run(search_articles("vitesse maximale engin de déplacement personnel motorisé")):
        print(r["level"], "|", r["ref"], "|", r["url"])
