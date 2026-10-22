"""Formats JSON stricts des agents (validés avec pydantic)."""
from typing import Literal

from pydantic import BaseModel, Field


class Obligation(BaseModel):
    id: str
    sujet: str
    action: str
    valeur: str | int | float | None = None
    condition: str | None = None
    sanction: str | None = None
    texte_source: str


class ExtractorOut(BaseModel):
    obligations: list[Obligation]


class ResearcherOut(BaseModel):
    article_ids: list[str]


class Citation(BaseModel):
    ref: str
    version_date: str | None = None
    url: str | None = None
    excerpt: str = ""


class Judgement(BaseModel):
    type: Literal["conflit", "doublon", "vide", "compatible"]
    explanation: str
    citations: list[Citation] = []
    confidence: float = Field(ge=0, le=1)


class ReporterOut(BaseModel):
    summary: str
