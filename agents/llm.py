"""Appels à Claude + sortie JSON stricte validée par pydantic (1 nouvel essai si invalide)."""
import json
import re

from pydantic import BaseModel, ValidationError

from agents.config import EFFORT, client

# Sonnet / Opus 5.5 : si le modèle refuse à tort une question légitime, l'API relance la requête
# sur un autre modèle (repli serveur). Haiku 5.5 n'a pas ce mécanisme.
FALLBACK_MODELS = ("claude-sonnet-5-5", "claude-opus-5-5")


async def call(model: str, system: str, messages: list, tools: list | None = None, max_tokens: int = 8000):
    kwargs = dict(model=model, max_tokens=max_tokens, system=system, messages=messages,
                  output_config={"effort": EFFORT})
    if tools:
        kwargs["tools"] = tools
    if model.startswith(FALLBACK_MODELS):
        response = await client().beta.messages.create(
            **kwargs, betas=["server-side-fallback-2026-07-01"], fallbacks="default")
    else:
        response = await client().messages.create(**kwargs)
    if response.stop_reason == "refusal":
        raise RuntimeError("le modèle a refusé de répondre")
    return response


def text_of(response) -> str:
    return "\n".join(b.text for b in response.content if b.type == "text").strip()


def parse_json(text: str, schema: type[BaseModel]) -> BaseModel:
    """Extrait le premier objet JSON du texte (même entouré de ```json) et le valide."""
    match = re.search(r"\{.*\}", text, re.S)
    if not match:
        raise ValueError("aucun objet JSON trouvé")
    return schema.model_validate(json.loads(match.group(0)))


def json_instructions(schema: type[BaseModel]) -> str:
    return ("\n\nRéponds UNIQUEMENT avec un objet JSON valide (sans texte autour) conforme à ce schéma :\n"
            + json.dumps(schema.model_json_schema(), ensure_ascii=False))


async def ask_json(model: str, system: str, user: str, schema: type[BaseModel]) -> BaseModel:
    messages = [{"role": "user", "content": user}]
    for attempt in range(2):
        response = await call(model, system + json_instructions(schema), messages)
        try:
            return parse_json(text_of(response), schema)
        except (ValueError, ValidationError) as e:  # json.JSONDecodeError hérite de ValueError
            if attempt == 1:
                raise
            messages += [
                {"role": "assistant", "content": response.content},
                {"role": "user", "content": f"Ton JSON est invalide ({str(e)[:300]}). "
                                            "Renvoie uniquement le JSON corrigé, conforme au schéma."},
            ]
