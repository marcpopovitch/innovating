"""Clients des API externes : Harmonic (données startups) et Keenable (recherche web).

Les formats de réponse de ces API ne sont pas garantis : on lit les champs
de façon défensive et on ne plante jamais l'app si une API est injoignable.
"""
import re
from urllib.parse import urlparse

import httpx

from backend.config import HARMONIC_API_KEY, KEENABLE_API_KEY

HARMONIC_URL = "https://api.harmonic.ai"
KEENABLE_URL = "https://api.keenable.ai/v1/search"
TIMEOUT = 20


# ---------------------------------------------------------------- Harmonic
def _harmonic(method: str, path: str, **kwargs) -> dict | list:
    if not HARMONIC_API_KEY:
        raise RuntimeError("HARMONIC_API_KEY manquante")
    r = httpx.request(method, HARMONIC_URL + path, headers={"apikey": HARMONIC_API_KEY},
                      timeout=TIMEOUT, **kwargs)
    r.raise_for_status()
    return r.json()


def harmonic_search(query: str, size: int = 50) -> list[dict]:
    """Recherche de startups en langage naturel (endpoint "search agent").
    À vérifier dans la doc Harmonic de l'équipe : forme exacte de la réponse."""
    data = _harmonic("GET", "/search/search_agent", params={"query": query, "size": size})
    items = data.get("results", data) if isinstance(data, dict) else data
    companies = []
    for item in items or []:
        # La réponse peut contenir les entreprises complètes ou seulement leurs URN/id.
        if isinstance(item, dict) and item.get("name"):
            companies.append(item)
        else:
            cid = item.get("id") or item.get("urn") if isinstance(item, dict) else item
            cid = str(cid).split(":")[-1]
            companies.append(harmonic_company(cid))
    return companies


def harmonic_company(company_id: str) -> dict:
    return _harmonic("GET", f"/companies/{company_id}")


def harmonic_enrich(website_or_linkedin: str) -> dict:
    """Enrichit une entreprise à partir de son site ou de sa page LinkedIn."""
    if "linkedin.com" in website_or_linkedin:
        return _harmonic("POST", "/companies", params={"linkedin_url": website_or_linkedin})
    return _harmonic("POST", "/companies", params={"website_domain": domain_of(website_or_linkedin)})


def harmonic_company_of_person(linkedin_url: str) -> dict:
    """LinkedIn d'un founder -> fiche Harmonic de son entreprise actuelle."""
    person = _harmonic("POST", "/persons", params={"linkedin_url": linkedin_url})
    jobs = person.get("experience") or []
    current = next((j for j in jobs if j.get("is_current_position")), jobs[0] if jobs else None)
    if not current or not current.get("company"):
        raise RuntimeError("entreprise actuelle introuvable pour ce profil")
    return harmonic_company(str(current["company"]).split(":")[-1])


def _get(d: dict, *path, default=None):
    for key in path:
        if not isinstance(d, dict):
            return default
        d = d.get(key)
    return d if d is not None else default


def normalize_company(c: dict) -> dict:
    """Réponse Harmonic -> ligne de la table startups."""
    website = _get(c, "website", "url") or _get(c, "website", "domain") or c.get("website")
    tags = c.get("tags_v2") or c.get("tags") or []
    sector = next((t.get("display_value") for t in tags if isinstance(t, dict)
                   and t.get("type") in ("MARKET_VERTICAL", "INDUSTRY")), None)
    sector = sector or c.get("sector") or next((t.get("display_value") for t in tags if isinstance(t, dict)), None)
    founded = _get(c, "founding_date", "date") or ""
    return {
        "id": str(c.get("entity_urn") or c.get("id") or domain_of(website or c.get("name", ""))).split(":")[-1],
        "name": c.get("name") or "?",
        "website": website,
        "linkedin_url": _get(c, "socials", "LINKEDIN", "url") or _get(c, "socials", "linkedin", "url"),
        "sector": sector or "Autre",
        "region": _get(c, "location", "region") or c.get("region"),
        "country": _get(c, "location", "country"),
        "city": _get(c, "location", "city"),
        "description": c.get("description") or c.get("short_description"),
        "stage": c.get("stage"),
        "founded_year": int(founded[:4]) if str(founded)[:4].isdigit() else None,
        "headcount": c.get("headcount"),
        "funding_total_usd": _get(c, "funding", "funding_total"),
        "data_source": "harmonic",
        "raw": c,
    }


# ---------------------------------------------------------------- Keenable
def web_search(query: str, count: int = 5) -> list[dict]:
    """Recherche web via Keenable. Renvoie [{url, title, snippet}]."""
    if not KEENABLE_API_KEY:
        raise RuntimeError("KEENABLE_API_KEY manquante : recherche web indisponible")
    r = httpx.post(KEENABLE_URL, headers={"X-API-Key": KEENABLE_API_KEY},
                   json={"query": query, "count": count}, timeout=TIMEOUT)
    r.raise_for_status()
    data = r.json()
    items = data.get("results") or data.get("data") or [] if isinstance(data, dict) else data
    return [
        {"url": it.get("url"), "title": it.get("title") or "",
         "snippet": it.get("snippet") or it.get("description") or it.get("content") or ""}
        for it in items[:count] if isinstance(it, dict) and it.get("url")
    ]


# ---------------------------------------------------------------- Divers
def domain_of(url: str) -> str:
    if not re.match(r"^https?://", url or ""):
        url = "https://" + (url or "")
    return urlparse(url).netloc.lower().removeprefix("www.")
