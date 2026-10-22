"""Accès aux données.

- DATABASE_URL défini  -> PostgreSQL (Aiven) + pgvector.
- DATABASE_URL vide    -> stockage en mémoire, initialisé avec data/sample_startups.json.
  Pratique pour développer sans base ; tout est perdu au redémarrage.

Les deux modes exposent exactement les mêmes fonctions.
"""
import json
import re
import threading
from datetime import datetime, timezone

from backend.config import DATABASE_URL, ROOT, SAMPLE_FILE
from backend.embeddings import embed

USE_PG = bool(DATABASE_URL)
PODS = ["market", "team", "product", "icp"]
STARTUP_FIELDS = [
    "id", "name", "website", "linkedin_url", "sector", "region", "country", "city",
    "description", "stage", "founded_year", "headcount", "funding_total_usd", "data_source",
]
CHUNK_SIZE = 1200


def now() -> datetime:
    return datetime.now(timezone.utc)


def _chunks(text: str) -> list[str]:
    text = (text or "").strip()
    return [text[i:i + CHUNK_SIZE] for i in range(0, len(text), CHUNK_SIZE)][:5]


def _words(q: str) -> list[str]:
    return [w for w in re.findall(r"\w+", (q or "").lower()) if len(w) > 2]


# ---------------------------------------------------------------- PostgreSQL
def _conn():
    import psycopg
    from pgvector.psycopg import register_vector
    from psycopg.rows import dict_row

    conn = psycopg.connect(DATABASE_URL, autocommit=True, row_factory=dict_row)
    register_vector(conn)
    return conn


def init_schema() -> None:
    """Crée les tables (data/schema.sql). Postgres uniquement."""
    import psycopg

    sql = (ROOT / "data" / "schema.sql").read_text(encoding="utf-8")
    with psycopg.connect(DATABASE_URL, autocommit=True) as conn:
        conn.execute(sql)


def ping() -> bool:
    if not USE_PG:
        return True
    try:
        with _conn() as c:
            c.execute("SELECT 1")
        return True
    except Exception as e:
        print(f"[db] ping KO : {e}")
        return False


# ---------------------------------------------------------------- Mémoire
_lock = threading.Lock()
_mem: dict | None = None


def _m() -> dict:
    global _mem
    if _mem is None:
        startups = json.loads(SAMPLE_FILE.read_text(encoding="utf-8"))
        _mem = {
            "startups": {s["id"]: {**s, "fetched_at": now()} for s in startups},
            "sources": {},  # url -> {url, title, fetched_at}
            "chunks": [],   # {startup_id, url, content}
            "facts": [],
            "messages": [],
        }
    return _mem


# ---------------------------------------------------------------- Startups
def list_startups(region: str | None = None, q: str | None = None, limit: int = 1000) -> list[dict]:
    if USE_PG:
        sql = f"SELECT {', '.join(STARTUP_FIELDS)} FROM startups WHERE TRUE"
        params: list = []
        if region:
            sql += " AND region = %s"
            params.append(region)
        if q:
            sql += " AND (name ILIKE %s OR description ILIKE %s OR sector ILIKE %s)"
            params += [f"%{q}%"] * 3
        sql += " ORDER BY name LIMIT %s"
        params.append(limit)
        with _conn() as c:
            return c.execute(sql, params).fetchall()

    rows = list(_m()["startups"].values())
    if region:
        rows = [s for s in rows if s.get("region") == region]
    if q:
        ql = q.lower()
        rows = [s for s in rows if any(ql in (s.get(k) or "").lower() for k in ("name", "description", "sector"))]
    return [{k: s.get(k) for k in STARTUP_FIELDS} for s in sorted(rows, key=lambda s: s["name"])][:limit]


def get_startup(startup_id: str) -> dict | None:
    if USE_PG:
        with _conn() as c:
            return c.execute(
                f"SELECT {', '.join(STARTUP_FIELDS)}, fetched_at FROM startups WHERE id = %s", [startup_id]
            ).fetchone()
    s = _m()["startups"].get(startup_id)
    return dict(s) if s else None


def upsert_startup(s: dict) -> None:
    row = {k: s.get(k) for k in STARTUP_FIELDS}
    row["data_source"] = row["data_source"] or "harmonic"
    if USE_PG:
        from psycopg.types.json import Jsonb

        cols = STARTUP_FIELDS + ["raw", "fetched_at"]
        updates = ", ".join(f"{c} = EXCLUDED.{c}" for c in cols if c != "id")
        with _conn() as c:
            c.execute(
                f"INSERT INTO startups ({', '.join(cols)}) VALUES ({', '.join(['%s'] * len(cols))}) "
                f"ON CONFLICT (id) DO UPDATE SET {updates}",
                [row[k] for k in STARTUP_FIELDS] + [Jsonb(s.get("raw")), now()],
            )
        return
    with _lock:
        _m()["startups"][row["id"]] = {**row, "fetched_at": now()}


def list_regions() -> list[str]:
    return sorted({s["region"] for s in list_startups() if s.get("region")})


# ---------------------------------------------------------------- Sources + chunks
def add_source(url: str, title: str, content: str, startup_id: str | None) -> datetime:
    """Enregistre une source et ses morceaux de texte (avec embeddings). Renvoie fetched_at."""
    fetched_at = now()
    parts = _chunks(content)
    vectors = (embed(parts) if USE_PG else None) or [None] * len(parts)  # en mémoire : mots-clés
    if USE_PG:
        with _conn() as c:
            source_id = c.execute(
                "INSERT INTO sources (url, title, fetched_at) VALUES (%s, %s, %s) "
                "ON CONFLICT (url) DO UPDATE SET title = EXCLUDED.title, fetched_at = EXCLUDED.fetched_at "
                "RETURNING id",
                [url, title, fetched_at],
            ).fetchone()["id"]
            c.execute("DELETE FROM chunks WHERE source_id = %s AND startup_id IS NOT DISTINCT FROM %s",
                      [source_id, startup_id])
            import numpy as np

            for part, vec in zip(parts, vectors):
                c.execute(
                    "INSERT INTO chunks (startup_id, source_id, content, embedding) VALUES (%s, %s, %s, %s)",
                    [startup_id, source_id, part, np.array(vec) if vec is not None else None],
                )
        return fetched_at
    with _lock:
        m = _m()
        m["sources"][url] = {"url": url, "title": title, "fetched_at": fetched_at}
        m["chunks"] = [ch for ch in m["chunks"] if not (ch["url"] == url and ch["startup_id"] == startup_id)]
        m["chunks"] += [{"startup_id": startup_id, "url": url, "content": p} for p in parts]
    return fetched_at


def get_source(url: str) -> dict | None:
    if USE_PG:
        with _conn() as c:
            return c.execute("SELECT url, title, fetched_at FROM sources WHERE url = %s", [url]).fetchone()
    return _m()["sources"].get(url)


def search_chunks(query: str, startup_id: str | None = None, sector: str | None = None, k: int = 6) -> list[dict]:
    """Recherche dans les textes stockés : d'une startup, ou de tout son secteur.
    Vectorielle si possible, sinon par mots-clés."""
    if USE_PG:
        where, params = "TRUE", []
        if startup_id:
            where += " AND ch.startup_id = %s"
            params.append(startup_id)
        if sector:
            where += " AND st.sector = %s"
            params.append(sector)
        base = (
            "SELECT ch.content, s.url, s.title, s.fetched_at, st.name AS startup "
            "FROM chunks ch JOIN sources s ON s.id = ch.source_id "
            f"LEFT JOIN startups st ON st.id = ch.startup_id WHERE {where}"
        )
        vec = embed([query])
        with _conn() as c:
            if vec:
                import numpy as np

                return c.execute(
                    base + " AND ch.embedding IS NOT NULL ORDER BY ch.embedding <=> %s LIMIT %s",
                    params + [np.array(vec[0]), k],
                ).fetchall()
            words = _words(query)
            if not words:
                return []
            return c.execute(
                base + " AND to_tsvector('simple', ch.content) @@ to_tsquery('simple', %s) "
                "ORDER BY ts_rank(to_tsvector('simple', ch.content), to_tsquery('simple', %s)) DESC LIMIT %s",
                params + [" | ".join(words)] * 2 + [k],
            ).fetchall()

    m = _m()
    words = _words(query)
    sector_ids = {s["id"] for s in m["startups"].values() if s.get("sector") == sector} if sector else None
    scored = []
    for ch in m["chunks"]:
        if startup_id and ch["startup_id"] != startup_id:
            continue
        if sector_ids is not None and ch["startup_id"] not in sector_ids:
            continue
        text = ch["content"].lower()
        score = sum(text.count(w) for w in words)
        if score:
            src = m["sources"][ch["url"]]
            startup = m["startups"].get(ch["startup_id"], {}).get("name")
            scored.append((score, {**src, "content": ch["content"], "startup": startup}))
    return [row for _, row in sorted(scored, key=lambda x: -x[0])[:k]]


# ---------------------------------------------------------------- Faits
def get_facts(startup_id: str, pod: str | None = None) -> list[dict]:
    if USE_PG:
        sql = "SELECT pod, content, source_url, fetched_at FROM facts WHERE startup_id = %s"
        params = [startup_id]
        if pod:
            sql += " AND pod = %s"
            params.append(pod)
        with _conn() as c:
            return c.execute(sql + " ORDER BY pod, id", params).fetchall()
    return [
        {k: f[k] for k in ("pod", "content", "source_url", "fetched_at")}
        for f in _m()["facts"]
        if f["startup_id"] == startup_id and (pod is None or f["pod"] == pod)
    ]


def add_fact(startup_id: str, pod: str, content: str, source_url: str, fetched_at: datetime) -> None:
    if USE_PG:
        with _conn() as c:
            c.execute(
                "INSERT INTO facts (startup_id, pod, content, source_url, fetched_at) VALUES (%s, %s, %s, %s, %s)",
                [startup_id, pod, content, source_url, fetched_at],
            )
        return
    with _lock:
        _m()["facts"].append({"startup_id": startup_id, "pod": pod, "content": content,
                              "source_url": source_url, "fetched_at": fetched_at})


def delete_facts(startup_id: str, pod: str) -> None:
    if USE_PG:
        with _conn() as c:
            c.execute("DELETE FROM facts WHERE startup_id = %s AND pod = %s", [startup_id, pod])
        return
    with _lock:
        m = _m()
        m["facts"] = [f for f in m["facts"] if not (f["startup_id"] == startup_id and f["pod"] == pod)]


# ---------------------------------------------------------------- Chat
def add_message(startup_id: str, role: str, content: str, sources: list | None = None) -> None:
    if USE_PG:
        from psycopg.types.json import Jsonb

        with _conn() as c:
            c.execute("INSERT INTO messages (startup_id, role, content, sources) VALUES (%s, %s, %s, %s)",
                      [startup_id, role, content, Jsonb(sources or [])])
        return
    with _lock:
        _m()["messages"].append({"startup_id": startup_id, "role": role, "content": content,
                                 "sources": sources or [], "created_at": now()})


def get_messages(startup_id: str, limit: int = 20) -> list[dict]:
    if USE_PG:
        with _conn() as c:
            rows = c.execute(
                "SELECT role, content, sources, created_at FROM messages WHERE startup_id = %s "
                "ORDER BY created_at DESC LIMIT %s", [startup_id, limit]
            ).fetchall()
        return rows[::-1]
    return [msg for msg in _m()["messages"] if msg["startup_id"] == startup_id][-limit:]
