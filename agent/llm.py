"""Boucle agent minimale avec tool use (SDK anthropic).

Claude demande des outils -> on les exécute (en parallèle) -> on renvoie les résultats
-> on recommence jusqu'à la réponse finale.
"""
import json
from concurrent.futures import ThreadPoolExecutor
from typing import Callable

import anthropic

from backend.config import CLAUDE_EFFORT, CLAUDE_MODEL

_client: anthropic.Anthropic | None = None


def client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        _client = anthropic.Anthropic()  # lit ANTHROPIC_API_KEY dans l'environnement
    return _client


def ask(system: str, messages: list, tools: list | None = None, effort: str = CLAUDE_EFFORT):
    """Un appel à Claude. Le repli serveur ("fallbacks") relance la requête sur un autre
    modèle si le modèle principal refuse par erreur une question légitime."""
    return client().beta.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=16000,
        system=system,
        messages=messages,
        tools=tools or [],
        output_config={"effort": effort},
        betas=["server-side-fallback-2026-07-01"],
        fallbacks="default",
    )


def text_of(response) -> str:
    return "\n".join(b.text for b in response.content if b.type == "text").strip()


def run_agent(system: str, prompt: str, tools: list, handlers: dict[str, Callable],
              history: list | None = None, max_turns: int = 10) -> str:
    messages = list(history or []) + [{"role": "user", "content": prompt}]

    def run_tool(block) -> dict:
        try:
            out = handlers[block.name](**block.input)
            return {"type": "tool_result", "tool_use_id": block.id,
                    "content": json.dumps(out, ensure_ascii=False, default=str)}
        except Exception as e:  # l'erreur est renvoyée à Claude, qui peut s'adapter
            return {"type": "tool_result", "tool_use_id": block.id, "content": f"Erreur : {e}", "is_error": True}

    for _ in range(max_turns):
        response = ask(system, messages, tools)
        messages.append({"role": "assistant", "content": response.content})

        if response.stop_reason == "tool_use":
            calls = [b for b in response.content if b.type == "tool_use"]
            with ThreadPoolExecutor(max_workers=4) as ex:
                results = list(ex.map(run_tool, calls))
            messages.append({"role": "user", "content": results})  # tous les résultats dans un seul message
            continue
        if response.stop_reason == "pause_turn":
            continue
        if response.stop_reason == "refusal":
            return "Je ne peux pas répondre à cette demande."
        return text_of(response)  # end_turn, max_tokens...

    return "Analyse interrompue : trop d'étapes."
