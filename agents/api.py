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
