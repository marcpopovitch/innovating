"""Contrôle du corpus data/mock_articles.json.

    python -m tests.check_corpus

Affiche : nombre d'articles par level, emplacements encore en TODO, refs en double,
levels inconnus. Code de sortie 1 s'il y a une ref en double ou un level inconnu.
"""
import json
import sys
from collections import Counter

from agents.config import ROOT
from agents.schemas import LEVELS
from agents.search import infer_level

rows = json.loads((ROOT / "data" / "mock_articles.json").read_text(encoding="utf-8"))
levels = [a.get("level") or infer_level(a["ref"]) or "?" for a in rows]

print(f"{len(rows)} entrées dans le corpus\n\nPar level :")
counts = Counter(levels)
for level in (*LEVELS, "?"):
    if counts[level]:
        print(f"  {level:<14}{counts[level]}")

todo = [a for a in rows if "TODO" in (a.get("text"), a.get("url"), a.get("version_date"))]
print(f"\nEncore en TODO ({len(todo)}) — ignorés par la recherche tant que le texte manque :")
for a in todo:
    missing = [k for k in ("text", "url", "version_date") if a.get(k) == "TODO"]
    print(f"  - {a['ref']}  [{', '.join(missing)}]")

dupes = [ref for ref, n in Counter(a["ref"] for a in rows).items() if n > 1]
dup_ids = [i for i, n in Counter(a["id"] for a in rows).items() if n > 1]
unknown = [a["ref"] for a, lvl in zip(rows, levels) if lvl not in LEVELS]

print(f"\nRefs en double : {dupes or 'aucune'}")
print(f"Ids en double : {dup_ids or 'aucun'}")
print(f"Levels inconnus : {unknown or 'aucun'}")
sys.exit(1 if dupes or dup_ids or unknown else 0)
