"""Garde-fou anti-hallucination, en code (pas par le LLM).

- Une citation dont la "ref" n'est pas dans les articles réellement renvoyés par search_articles
  est supprimée et comptée.
- Pour les citations gardées, date et URL sont reprises de l'article réel. Si l'extrait n'est pas
  mot pour mot dans le texte, il est remplacé par le début du vrai texte.
- Un finding sans citation passe en "vide" et sa confiance est divisée par deux.
"""
import re

from agents.schemas import Citation, Judgement


def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", s.replace("’", "'").replace(" ", " ")).strip().lower()


def validate(j: Judgement, returned_articles: list[dict]) -> tuple[Judgement, int]:
    by_ref = {_norm(a["ref"]): a for a in returned_articles}
    kept, rejected = [], 0
    for c in j.citations:
        article = by_ref.get(_norm(c.ref))
        if article is None:
            rejected += 1
            continue
        excerpt = c.excerpt if c.excerpt and _norm(c.excerpt) in _norm(article["text"]) else article["text"][:300]
        kept.append(Citation(ref=article["ref"], version_date=article["version_date"],
                             url=article["url"], excerpt=excerpt))

    j = j.model_copy(update={"citations": kept})
    if not kept and j.type != "vide":
        j = j.model_copy(update={
            "type": "vide",
            "confidence": round(j.confidence * 0.5, 2),
            "explanation": j.explanation + " [Aucune citation vérifiable : requalifié en « vide ».]",
        })
    return j, rejected
