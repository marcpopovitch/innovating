"""Agent chercheur : 1 obligation -> 3 à 5 articles pertinents. Seul agent avec tool use."""
import json

from agents.config import MODEL_FAST
from agents.llm import call, json_instructions, parse_json, text_of
from agents.schemas import LEVELS, Obligation, ResearcherOut
from agents.search import search_articles

MAX_TOOL_CALLS = 4

TOOL = {
    "name": "search_articles",
    "description": "Recherche dans les textes juridiques RÉELS en vigueur, récupérés en direct sur le web "
                   "(Légifrance pour le droit français, EUR-Lex pour le droit de l'UE). "
                   "Renvoie une liste d'articles réels : id, ref, level, version_date, text.",
    "input_schema": {
        "type": "object",
        "properties": {
            "query": {"type": "string", "description": "Mots-clés juridiques."},
            "filters": {
                "type": "object",
                "properties": {"level": {"type": "string", "enum": list(LEVELS)}},
                "description": "Optionnel : filtrer par niveau de norme.",
            },
        },
        "required": ["query"],
    },
}

SYSTEM = f"""Tu es documentaliste juridique. Trouve les articles en vigueur qui portent sur la même
question que l'obligation donnée.
Méthode :
1. Lance 2 à 3 recherches avec search_articles. Combine termes juridiques et synonymes
   (ex. trottinette électrique / engin de déplacement personnel motorisé / EDPM ; casque /
   équipement de protection ; vitesse / vitesse maximale par construction).
2. Si une recherche ne renvoie rien, reformule avec d'autres termes.
3. {MAX_TOOL_CALLS} recherches au maximum au total.
Quand tu as fini, choisis 3 à 5 articles pertinents parmi ceux renvoyés (moins s'il y en a moins,
aucun si rien n'est pertinent).""" + json_instructions(ResearcherOut)


def _compact(a: dict) -> dict:
    return {"id": a["id"], "ref": a["ref"], "level": a["level"], "version_date": a["version_date"],
            "text": a["text"][:600]}


async def research(obligation: Obligation) -> tuple[list[dict], list[dict]]:
    """Renvoie (articles retenus, tous les articles réellement renvoyés par search_articles)."""
    found: dict[str, dict] = {}
    calls = 0
    retried = False
    messages = [{"role": "user", "content": f"Obligation :\n{obligation.model_dump_json(indent=1)}"}]

    for _ in range(MAX_TOOL_CALLS + 3):
        response = await call(MODEL_FAST, SYSTEM, messages, tools=[TOOL])
        messages.append({"role": "assistant", "content": response.content})

        if response.stop_reason == "tool_use":
            results = []
            for block in (b for b in response.content if b.type == "tool_use"):
                if calls >= MAX_TOOL_CALLS:
                    content = f"Limite de {MAX_TOOL_CALLS} recherches atteinte : donne ta réponse finale."
                else:
                    calls += 1
                    articles = await search_articles(block.input.get("query", ""), block.input.get("filters"))
                    found.update({a["id"]: a for a in articles})
                    content = (json.dumps([_compact(a) for a in articles], ensure_ascii=False) if articles
                               else "Aucun résultat : reformule avec d'autres termes ou des synonymes.")
                results.append({"type": "tool_result", "tool_use_id": block.id, "content": content})
            messages.append({"role": "user", "content": results})
            continue

        try:
            ids = parse_json(text_of(response), ResearcherOut).article_ids
            break
        except ValueError as e:  # JSON invalide (ValidationError hérite aussi de ValueError) : 1 essai de plus
            if retried:
                ids = []
                break
            retried = True
            messages.append({"role": "user", "content": f"JSON invalide ({str(e)[:200]}). "
                                                        "Renvoie uniquement le JSON corrigé."})
    else:
        ids = []

    # Garde-fou : on ne garde que des ids réellement renvoyés, sans doublon.
    selected = [found[i] for i in dict.fromkeys(ids) if i in found][:5]
    if not selected and not ids:
        selected = list(found.values())[:5]  # le modèle n'a pas conclu : on garde les premiers résultats
    return selected, list(found.values())
