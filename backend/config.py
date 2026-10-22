"""Toute la config vient des variables d'environnement (fichier .env en local)."""
import os
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
HARMONIC_API_KEY = os.getenv("HARMONIC_API_KEY", "")
KEENABLE_API_KEY = os.getenv("KEENABLE_API_KEY", "")
DATABASE_URL = os.getenv("DATABASE_URL", "")

CLAUDE_MODEL = os.getenv("CLAUDE_MODEL", "claude-opus-5-5")
CLAUDE_EFFORT = os.getenv("CLAUDE_EFFORT", "medium")  # low | medium | high
FACT_MAX_AGE_DAYS = int(os.getenv("FACT_MAX_AGE_DAYS", "30"))
EMBED_MODEL = os.getenv("EMBED_MODEL", "BAAI/bge-small-en-v1.5")  # 384 dimensions

SAMPLE_FILE = ROOT / "data" / "sample_startups.json"
CACHE_DIR = ROOT / "data" / "cache"
