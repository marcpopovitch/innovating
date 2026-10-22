"""LexGuard dashboard entrypoint and read-only integration for the data collector.

Run independently: uvicorn backend.lexguard:app --reload
The collector publishes a JSON snapshot atomically to LEXGUARD_DATA_FILE.
"""
import json
import logging
import os
from pathlib import Path

from fastapi import APIRouter, FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from backend.analysis import router as analysis_router

ROOT = Path(__file__).resolve().parent.parent
FRONTEND = ROOT / "frontend"
logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/lexguard", tags=["LexGuard"])


def valid_snapshot(payload: object) -> bool:
    if not isinstance(payload, dict) or payload.get("mode") != "live":
        return False
    stats = payload.get("stats")
    if not isinstance(stats, dict) or not all(
        isinstance(stats.get(key), (int, float)) and stats[key] >= 0
        for key in ("texts", "analyses", "sources")
    ):
        return False
    required_fields = {
        "alerts": ("id", "title", "type"),
        "documents": ("id", "title"),
        "sources": ("id", "name"),
        "trend": ("label",),
    }
    for collection, fields in required_fields.items():
        items = payload.get(collection)
        if not isinstance(items, list) or not all(
            isinstance(item, dict) and all(isinstance(item.get(key), str) for key in fields)
            for item in items
        ):
            return False
    if not all(isinstance(s.get("count"), (int, float)) and s["count"] >= 0 for s in payload["sources"]):
        return False
    return all(
        all(isinstance(t.get(k), (int, float)) and t[k] >= 0 for k in ("detected", "resolved"))
        for t in payload["trend"]
    )


@router.get("/dashboard")
def dashboard():
    source = Path(os.environ.get("LEXGUARD_DATA_FILE", str(ROOT / "data" / "lexguard.json")))
    try:
        payload = json.loads(source.read_text(encoding="utf-8"))
    except FileNotFoundError:
        raise HTTPException(503, "Collecte non connectée. Le dashboard affiche des exemples fictifs.")
    except (OSError, ValueError):
        logger.warning("Impossible de lire le snapshot LexGuard.")
        raise HTTPException(503, "Les données de collecte sont temporairement indisponibles.")
    if not valid_snapshot(payload):
        raise HTTPException(503, "Le format des données de collecte est invalide.")
    return payload


app = FastAPI(title="LexGuard Gov", description="Vigilance et cohérence législative")
app.include_router(router)
app.include_router(analysis_router)
app.mount("/static", StaticFiles(directory=FRONTEND), name="static")


@app.get("/")
def index():
    return FileResponse(FRONTEND / "index.html")


@app.get("/health")
def health():
    return {"status": "ok", "service": "lexguard-dashboard"}
