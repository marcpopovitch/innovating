"""API FastAPI. Lancer : uvicorn backend.main:app --reload"""
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, HTMLResponse, PlainTextResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from agent import chat as chat_agent
from agent import orchestrator
from backend import config, db, memo

app = FastAPI(title="VC Analyst")
FRONTEND = config.ROOT / "frontend"


def _need_claude():
    if not config.ANTHROPIC_API_KEY:
        raise HTTPException(503, "ANTHROPIC_API_KEY manquante (voir .env.example)")


def _startup_or_404(startup_id: str) -> dict:
    s = db.get_startup(startup_id)
    if not s:
        raise HTTPException(404, f"Startup inconnue : {startup_id}")
    return s


@app.get("/health")
def health():
    return {
        "status": "ok",
        "storage": "postgres" if db.USE_PG else "memory (échantillon JSON)",
        "db_ok": db.ping(),
        "keys": {
            "anthropic": bool(config.ANTHROPIC_API_KEY),
            "harmonic": bool(config.HARMONIC_API_KEY),
            "keenable": bool(config.KEENABLE_API_KEY),
        },
    }


@app.get("/startups")
def startups(region: str | None = None, q: str | None = None):
    return db.list_startups(region=region, q=q)


@app.get("/startups/{startup_id}")
def startup_detail(startup_id: str):
    """Dashboard déjà en base, sans lancer d'analyse."""
    _startup_or_404(startup_id)
    return orchestrator.dashboard(startup_id)


class ResolveIn(BaseModel):
    url: str


@app.post("/resolve")
def resolve(body: ResolveIn):
    """URL de site / LinkedIn (entreprise ou founder) -> startup en base."""
    return orchestrator.resolve(body.url)


@app.post("/analyze/{startup_id}")
def analyze(startup_id: str, refresh: bool = False):
    """Lance les 4 sous-agents (Marché, Équipe, Produit, ICP) et renvoie le dashboard."""
    _need_claude()
    _startup_or_404(startup_id)
    return orchestrator.analyze(startup_id, refresh=refresh)


class ChatIn(BaseModel):
    startup_id: str
    message: str


@app.post("/chat")
def chat(body: ChatIn):
    _need_claude()
    _startup_or_404(body.startup_id)
    return chat_agent.chat(body.startup_id, body.message)


@app.get("/chat/{startup_id}")
def chat_history(startup_id: str):
    return db.get_messages(startup_id, limit=50)


@app.get("/memo/{startup_id}")
def export_memo(startup_id: str, format: str = "md"):
    _startup_or_404(startup_id)
    if format == "html":
        return HTMLResponse(memo.to_html(startup_id))
    return PlainTextResponse(memo.to_markdown(startup_id), media_type="text/markdown; charset=utf-8")


# Front statique (HTML/JS + Plotly), servi par la même app.
app.mount("/static", StaticFiles(directory=FRONTEND), name="static")


@app.get("/")
def index():
    return FileResponse(FRONTEND / "index.html")
