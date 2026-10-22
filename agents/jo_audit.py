"""Audit de conformité du Journal Officiel par date/période.

Chaque texte du JO (récupéré par agents/jorf.py) est passé dans orchestrator.check(),
qui le confronte au droit en vigueur national (Légifrance) et européen (EUR-Lex) via Keenable.
Portée : conformité EXTERNE uniquement (pas de comparaison des textes du JO entre eux).
"""
from __future__ import annotations

import asyncio

from agents.jorf import NATURES, fetch_jorf
from agents.orchestrator import check

AUDIT_CONCURRENCY = 4  # textes analysés en parallèle (chaque check() parallélise déjà en interne)


async def _audit_one(sem: asyncio.Semaphore, t: dict) -> dict:
    async with sem:
        try:
            res = await check(t["text"])
        except Exception as e:
            res = {"findings": [], "summary": f"Analyse impossible : {type(e).__name__}: {e}",
                   "steps": [], "rejected_citations": 0}
    return {"id": t["id"], "nature": t["nature"], "title": t["title"], "url": t["url"],
            "findings": res.get("findings", []), "summary": res.get("summary", ""),
            "rejected_citations": res.get("rejected_citations", 0)}


async def audit_jo(date: str | None = None, date_from: str | None = None, date_to: str | None = None,
                   max_texts: int = 10, natures=NATURES) -> dict:
    texts = await fetch_jorf(date=date, date_from=date_from, date_to=date_to,
                             max_texts=max_texts, natures=natures)
    sem = asyncio.Semaphore(AUDIT_CONCURRENCY)
    audited = await asyncio.gather(*[_audit_one(sem, t) for t in texts])

    counts: dict[str, int] = {}
    rejected = 0
    for a in audited:
        rejected += a["rejected_citations"]
        for f in a["findings"]:
            counts[f["type"]] = counts.get(f["type"], 0) + 1

    return {"dates": [date] if date else [date_from, date_to],
            "texts_count": len(audited), "counts": counts,
            "rejected_citations": rejected, "texts": audited}
