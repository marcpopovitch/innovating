"""Config des agents : tout vient des variables d'environnement (.env à la racine en local)."""
import os
from pathlib import Path

from anthropic import AsyncAnthropic
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")

MODEL_FAST = os.getenv("MODEL_FAST", "claude-haiku-5-5")    # extracteur, chercheur, rapporteur
MODEL_JUDGE = os.getenv("MODEL_JUDGE", "claude-haiku-5-5")  # "claude-sonnet-5-5" pour la démo
EFFORT = os.getenv("AGENTS_EFFORT", "low")                  # low = rapide ; medium si besoin de plus de rigueur
TIMEOUT_S = float(os.getenv("CHECK_TIMEOUT_S", "60"))

_client: AsyncAnthropic | None = None


def client() -> AsyncAnthropic:
    global _client
    if _client is None:
        _client = AsyncAnthropic()  # lit ANTHROPIC_API_KEY
    return _client
