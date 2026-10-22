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
- Hiérarchie des normes (champ "level") : constitution (bloc de constitutionnalité : Constitution,
  DDHC, Préambule de 1946, Charte de l'environnement) > international (traités, CEDH, droit de
  l'UE) > loi > décret > arrêté. À niveau égal, le texte le plus récent (version_date) prévaut.
- La jurisprudence ("level": "jurisprudence") ne prévaut jamais : elle sert à interpréter un texte.
  Tu peux la citer pour appuyer ou nuancer un conflit, jamais comme norme supérieure.
- Un arrêté municipal plus restrictif qu'un décret n'est pas forcément un conflit : le maire peut,
  au titre de ses pouvoirs de police, aggraver localement une règle nationale si c'est justifié
  et proportionné. Explique-le au lieu de conclure "conflit" mécaniquement. Il y a conflit si
  l'arrêté autorise ce que le texte supérieur interdit, assouplit ses exigences, ou modifie
  une définition qu'il fixe.
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
