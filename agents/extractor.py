"""Agent extracteur : projet de texte -> liste d'obligations vérifiables."""
from agents.config import MODEL_FAST
from agents.llm import ask_json
from agents.schemas import ExtractorOut, Obligation

SYSTEM = """Tu es juriste légiste. On te donne un projet de texte réglementaire (décret, arrêté).
Découpe-le en obligations : 1 obligation = 1 règle vérifiable (une interdiction, une obligation,
un seuil, une sanction...).
Pour chaque obligation :
- id : "o1", "o2"...
- sujet : qui ou quoi est visé (ex. "vitesse maximale des EDPM")
- action : ce qui est imposé, permis ou interdit, en une courte phrase autonome
  (ex. "port du gilet jaune fluo obligatoire"). Deux obligations ne doivent jamais avoir
  la même action.
- valeur : la valeur chiffrée si elle existe (ex. "30 km/h"), sinon null
- condition : la condition d'application si elle existe, sinon null
- sanction : la sanction prévue si elle existe, sinon null
- texte_source : la phrase exacte du projet dont elle est tirée
N'invente rien qui ne soit pas dans le projet. Ignore les visas, considérants et articles d'exécution."""


async def extract(draft_text: str) -> list[Obligation]:
    out = await ask_json(MODEL_FAST, SYSTEM, f"Projet de texte :\n\n{draft_text}", ExtractorOut)
    return out.obligations
