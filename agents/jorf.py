"""Récupération du contenu du Journal Officiel (JORF) par date, sans OCR.

La LISTE des textes d'une date vient de l'open data DILA (déterministe, sans clé) :
archives https://echanges.dila.gouv.fr/OPENDATA/JORF/JORF_YYYYMMDD-HHMMSS.tar.gz
(fichiers texte/version/JORFTEXT….xml avec NATURE, TITREFULL, DATE_PUBLI, ID).
Le CORPS de chaque texte est récupéré en texte propre via Keenable (page /jorf/id/…),
car le listing et le PDF Légifrance sont bloqués (403) aux accès automatisés.

fetch_jorf(date | période) -> [{"id","nature","title","url","text"}]
"""
from __future__ import annotations

import asyncio
import html
import io
import re
import tarfile
from datetime import date as _date, timedelta

import httpx

from agents.search import _client  # client AsyncKeenable partagé (lit KEENABLE_API_KEY)

DILA_BASE = "https://echanges.dila.gouv.fr/OPENDATA/JORF/"
JORF_URL = "https://www.legifrance.gouv.fr/jorf/id/{}"
NATURES = ("LOI", "ORDONNANCE", "DECRET", "ARRETE")   # textes normatifs (on ignore nominations, avis, décorations…)
TEXT_MAX_CHARS = 20_000
FETCH_CONCURRENCY = 6
_HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; Ciceron/1.0)"}

_ARCHIVE = re.compile(r"JORF_(\d{8})-\d{6}\.tar\.gz")


def _tag(name: str, xml: str) -> str | None:
    m = re.search(rf"<{name}>(.*?)</{name}>", xml, re.S)
    return html.unescape(m.group(1)).strip() if m else None


def _parse_texte(xml: str) -> dict | None:
    nid = _tag("ID", xml)
    if not nid or "JORFTEXT" not in nid:
        return None
    return {"id": nid, "nature": (_tag("NATURE", xml) or "").upper(),
            "title": _tag("TITREFULL", xml) or _tag("TITRE", xml) or "",
            "date_publi": _tag("DATE_PUBLI", xml) or ""}


def _list_texts_one_day(day: str, listing: str, natures) -> list[dict]:
    """Télécharge les archives DILA du jour et renvoie les métadonnées des textes substantiels (sync)."""
    yyyymmdd = day.replace("-", "")
    names = sorted({m.group(0) for m in _ARCHIVE.finditer(listing) if m.group(1) == yyyymmdd})
    out, seen = [], set()
    for name in names:
        try:
            data = httpx.get(DILA_BASE + name, headers=_HEADERS, timeout=60).content
            tf = tarfile.open(fileobj=io.BytesIO(data), mode="r:gz")
        except Exception:
            continue
        for member in tf.getmembers():
            if not member.isfile() or "/texte/version/" not in member.name:
                continue
            try:
                meta = _parse_texte(tf.extractfile(member).read().decode("utf-8", "ignore"))
            except Exception:
                meta = None
            if not meta or meta["id"] in seen:
                continue
            if meta["date_publi"] and meta["date_publi"] != day:
                continue
            if natures and meta["nature"] not in natures:
                continue
            seen.add(meta["id"])
            out.append(meta)
    return out


async def _fetch_body(meta: dict) -> dict | None:
    url = JORF_URL.format(meta["id"])
    try:
        page = await _client().fetch(url)
    except Exception:
        return None
    text = (page.content or "").strip()[:TEXT_MAX_CHARS]
    if not text:
        return None
    return {"id": meta["id"], "nature": meta["nature"],
            "title": meta["title"] or (page.title or "").strip(),
            "url": page.url or url, "text": text}


def _daterange(date_from: str, date_to: str) -> list[str]:
    a, b = _date.fromisoformat(date_from), _date.fromisoformat(date_to)
    if b < a:
        a, b = b, a
    return [(a + timedelta(days=i)).isoformat() for i in range((b - a).days + 1)]


async def fetch_jorf(date: str | None = None, date_from: str | None = None, date_to: str | None = None,
                     max_texts: int = 20, natures=NATURES) -> list[dict]:
    """Textes du JO pour une date (YYYY-MM-DD) ou une période, avec leur texte intégral."""
    days = [date] if date else _daterange(date_from, date_to)
    listing = await asyncio.to_thread(lambda: httpx.get(DILA_BASE, headers=_HEADERS, timeout=60).text)
    metas: list[dict] = []
    for day in days:
        metas.extend(await asyncio.to_thread(_list_texts_one_day, day, listing, natures))
    metas = metas[:max_texts]

    sem = asyncio.Semaphore(FETCH_CONCURRENCY)

    async def guarded(meta: dict):
        async with sem:
            return await _fetch_body(meta)

    bodies = await asyncio.gather(*[guarded(m) for m in metas])
    return [b for b in bodies if b]


if __name__ == "__main__":
    import sys
    arg = sys.argv[1] if len(sys.argv) > 1 else _date.today().isoformat()
    for t in asyncio.run(fetch_jorf(date=arg, max_texts=8)):
        print(t["nature"], "|", t["id"], "|", t["title"][:80], "|", len(t["text"]), "car.")
