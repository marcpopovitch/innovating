"""Charge un échantillon de startups Harmonic dans PostgreSQL.

    python -m data.load_harmonic --init                       # crée les tables + charge
    python -m data.load_harmonic --query "AI startups in France" --size 50

- Les réponses Harmonic sont mises en cache dans data/cache/ : on ne paie
  pas deux fois le même appel (--no-cache pour forcer).
- Si Harmonic est injoignable (pas de clé, réseau, quota...), on charge
  data/sample_startups.json à la place : la démo tourne quand même.
"""
import argparse
import json
import re

from agent import sources
from backend import db
from backend.config import CACHE_DIR, SAMPLE_FILE


def fetch(query: str, size: int, use_cache: bool) -> list[dict]:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cache = CACHE_DIR / f"harmonic_{re.sub(r'[^a-z0-9]+', '_', query.lower())}_{size}.json"
    if use_cache and cache.exists():
        print(f"Cache : {cache.name}")
        return json.loads(cache.read_text(encoding="utf-8"))
    companies = sources.harmonic_search(query, size)
    cache.write_text(json.dumps(companies, ensure_ascii=False), encoding="utf-8")
    return companies


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--query", default="venture-backed startups in Europe and North America")
    parser.add_argument("--size", type=int, default=50)
    parser.add_argument("--init", action="store_true", help="appliquer data/schema.sql avant")
    parser.add_argument("--no-cache", action="store_true")
    parser.add_argument("--sample-only", action="store_true", help="ne pas appeler Harmonic")
    args = parser.parse_args()

    if not db.USE_PG:
        raise SystemExit("DATABASE_URL vide : rien à charger (l'app utilise déjà l'échantillon en mémoire).")
    if args.init:
        db.init_schema()
        print("Schéma appliqué.")

    rows: list[dict] = []
    if not args.sample_only:
        try:
            rows = [sources.normalize_company(c) for c in fetch(args.query, args.size, not args.no_cache)]
        except Exception as e:
            print(f"Harmonic indisponible ({e}) -> échantillon de secours.")
    if not rows:
        rows = json.loads(SAMPLE_FILE.read_text(encoding="utf-8"))

    for row in rows:
        db.upsert_startup(row)
    print(f"{len(rows)} startups chargées ({rows[0]['data_source']}).")


if __name__ == "__main__":
    main()
