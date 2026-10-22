"""Agent rapporteur : tous les findings -> résumé de 3 à 5 phrases, conflits en premier."""
import json

from agents.config import MODEL_FAST
from agents.llm import ask_json
from agents.schemas import ReporterOut

SYSTEM = """Tu es juriste légiste. Résume en 3 à 5 phrases, en français, l'analyse d'un projet de texte
pour un collègue pressé. Commence par les conflits (avec l'article en cause), puis les doublons,
puis les vides juridiques. Reprends fidèlement le "type" de chaque finding, sans le changer.
Ne cite que des articles présents dans les findings. Ne parle pas des scores de confiance.
Pas de liste à puces."""


async def report(findings: list[dict]) -> str:
    out = await ask_json(MODEL_FAST, SYSTEM, json.dumps(findings, ensure_ascii=False, indent=1), ReporterOut)
    return out.summary
