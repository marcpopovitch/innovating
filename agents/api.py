"""API des agents. Lancer : uvicorn agents.api:app --reload --port 8000

POST /check  {"draft_text": "..."}
-> {"findings": [{"obligation", "type", "explanation", "citations", "confidence"}],
    "summary", "steps": [{"agent", "action", "ms"}], "rejected_citations": int}
Ce format est utilisé par le front : ne pas le modifier.
"""
import asyncio

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from agents.orchestrator import check
from agents.jo_audit import audit_jo

app = FastAPI(title="Ciceron — agents")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


class CheckIn(BaseModel):
    draft_text: str = Field(min_length=1)


@app.post("/check")
async def check_endpoint(body: CheckIn) -> dict:
    try:
        return await check(body.draft_text)
    except asyncio.TimeoutError:
        raise HTTPException(504, "Analyse trop longue (plus de 60 s)")
    except Exception as e:
        raise HTTPException(502, f"Erreur des agents : {type(e).__name__}: {e}")


class JoAuditIn(BaseModel):
    date: str | None = None                 # "YYYY-MM-DD"
    date_from: str | None = None            # période : bornes incluses
    date_to: str | None = None
    max_texts: int = Field(default=10, ge=1, le=60)


@app.post("/jo-audit")
async def jo_audit_endpoint(body: JoAuditIn) -> dict:
    """Audit de conformité du Journal Officiel pour une date ou une période (vs droit national + UE)."""
    if not body.date and not (body.date_from and body.date_to):
        raise HTTPException(400, "Fournir 'date' ou 'date_from'+'date_to' (format YYYY-MM-DD).")
    try:
        return await audit_jo(date=body.date, date_from=body.date_from, date_to=body.date_to,
                              max_texts=body.max_texts)
    except Exception as e:
        raise HTTPException(502, f"Audit JO impossible : {type(e).__name__}: {e}")
