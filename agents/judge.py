"""Agent juge : obligation + articles en vigueur -> conflit / doublon / vide / compatible."""
import json

from agents.config import MODEL_JUDGE
from agents.llm import ask_json
from agents.schemas import Judgement, Obligation

SYSTEM = """Tu es juriste légiste. Tu compares UNE obligation d'un projet de texte avec les articles
en vigueur fournis, et tu qualifies la relation :
- "conflit" : l'obligation contredit un article (valeur, interdiction ou condition incompatible) ;
- "doublon" : l'obligation répète ce qu'un article prévoit déjà, sans rien ajouter ;
- "compatible" : un article porte sur le même sujet et l'obligation est cohérente avec lui ;
- "vide" : aucun article fourni ne traite ce sujet (vide juridique comblé ou à combler).

Règles :
- Il n'y a conflit ou doublon que si l'article porte sur la MÊME règle : même objet, mêmes
  destinataires, même champ territorial. Une sanction prévue par un autre texte pour d'autres
  obligations n'est ni un conflit ni un doublon.
- Hiérarchie des normes : UE > loi > décret > arrêté. À niveau égal, le texte le plus récent
  (version_date) prévaut. Un arrêté ne peut pas déroger à un décret ou à une loi.
- Cite l'article exact : "ref" copiée MOT POUR MOT depuis les articles fournis, avec son
  "version_date", son "url" et un "excerpt" copié mot pour mot de son "text".
- N'utilise QUE les articles fournis. N'invente jamais un article, une référence ou un extrait.
- Si aucun article fourni n'est pertinent : type "vide", citations vides.
- explanation : 2 à 3 phrases, en français, qui disent précisément ce qui coince
  (sans mentionner d'identifiant interne comme "o1").
- confidence : entre 0 et 1."""


def _article_view(a: dict) -> dict:
    return {k: a[k] for k in ("ref", "level", "version_date", "url", "text")}


async def judge(obligation: Obligation, articles: list[dict]) -> Judgement:
    user = (f"Obligation du projet :\n{obligation.model_dump_json(indent=1)}\n\n"
            f"Articles en vigueur :\n{json.dumps([_article_view(a) for a in articles], ensure_ascii=False, indent=1)}")
    return await ask_json(MODEL_JUDGE, SYSTEM, user, Judgement)
