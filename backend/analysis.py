"""API de préparation d'une recherche ; ne lance aucun moteur de recherche."""
from fastapi import APIRouter

from agent.analysis import AnalysisInput, SearchRequest, prepare_analysis

router = APIRouter(prefix="/api/lexguard", tags=["Analyse"])


@router.post("/analysis", response_model=SearchRequest)
def analyze_request(body: AnalysisInput) -> SearchRequest:
    return prepare_analysis(body.text, body.options)
