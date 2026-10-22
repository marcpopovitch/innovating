"""Chat sur une startup et son secteur : base d'abord, web seulement si besoin, sources citées."""
import re

from agent.llm import run_agent
from agent.tools import Toolbox
from backend import db

TOOLS = ["get_startup_profile", "get_stored_facts", "search_knowledge", "web_search"]

SYSTEM = """Tu es l'analyste IA d'un associate VC. Tu réponds aux questions sur {name}
(secteur : {sector}) et sur son secteur.

Méthode :
1. Cherche d'abord en base : get_stored_facts, puis search_knowledge (scope "startup" ou "sector").
2. Utilise web_search seulement si la base ne contient pas la réponse.

Règles :
- Chaque affirmation factuelle cite sa source avec un numéro [1], [2]...
  Termine par une section « Sources » : une ligne par numéro avec l'URL et la date de récupération.
- N'utilise jamais tes connaissances générales pour un fait sur l'entreprise ou le marché.
- Si les outils ne donnent pas la réponse, dis-le clairement (« Je ne sais pas : ... »)
  au lieu de deviner.
- Réponds dans la langue de la question, de façon concise."""


def chat(startup_id: str, message: str) -> dict:
    startup = db.get_startup(startup_id)
    if not startup:
        raise KeyError(startup_id)

    history = [{"role": m["role"], "content": m["content"]} for m in db.get_messages(startup_id, limit=10)]
    box = Toolbox(startup)
    system = SYSTEM.format(name=startup["name"], sector=startup.get("sector") or "inconnu")
    answer = run_agent(system, message, box.definitions(TOOLS), box.handlers(TOOLS), history=history)

    # Sources effectivement citées : URL vues par les outils ET présentes dans la réponse.
    cited = [{"url": url, "fetched_at": fetched_at} for url, fetched_at in box.seen.items() if url in answer]
    db.add_message(startup_id, "user", message)
    db.add_message(startup_id, "assistant", answer, [{"url": c["url"], "fetched_at": str(c["fetched_at"])}
                                                     for c in cited])
    return {"answer": answer, "sources": cited, "said_unknown": bool(re.search(
        r"je ne sais pas|i don't know|i do not know|pas d'information|aucune source", answer, re.I))}
