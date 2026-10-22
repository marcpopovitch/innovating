"""Déploiement des agents Ciceron sur Modal.

Enveloppe l'API FastAPI existante (`agents.api:app`) dans une fonction Modal, sans la modifier.
Le corpus est récupéré en direct via Keenable (voir agents/search.py) : aucun Postgres requis.

Secrets attendus (créés avec `modal secret create ciceron ...`) :
    ANTHROPIC_API_KEY   (obligatoire)   clé Anthropic réelle (le helper local ne s'applique pas à distance)
    KEENABLE_API_KEY    (optionnel)     lève le throttling keyless de Keenable

Commandes :
    modal serve  agents/modal_app.py     # URL temporaire (dev)
    modal deploy agents/modal_app.py     # URL stable (prod) -> à mettre dans MODAL_AGENTS_URL côté Next.js
"""
import modal

app = modal.App("ciceron-agents")

image = (
    modal.Image.debian_slim(python_version="3.12")
    .pip_install_from_requirements("agents/requirements.txt")   # anthropic, fastapi, uvicorn, pydantic, dotenv, keenable
    .add_local_dir("data", remote_path="/root/data")            # mock de secours pour search.py
    .add_local_python_source("agents")                          # rend le package `agents` importable
)


@app.function(
    image=image,
    secrets=[modal.Secret.from_name("ciceron")],
    timeout=150,            # > CHECK_TIMEOUT_S (les fetch web sont plus lents que le mock)
    # min_containers=1,     # décommenter pour une démo sans cold start (coûte un peu plus)
)
@modal.concurrent(max_inputs=8)   # plusieurs analyses /check en parallèle par conteneur
@modal.asgi_app()
def fastapi_app():
    from agents.api import app as fastapi
    return fastapi
