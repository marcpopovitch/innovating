"""Embeddings locaux (fastembed). Si indisponible, on renvoie None et la recherche
passe en mode mots-clés : l'app continue de tourner."""
from functools import lru_cache

from backend.config import EMBED_MODEL, ROOT


@lru_cache(maxsize=1)
def _model():
    try:
        from fastembed import TextEmbedding

        # Modèle (~70 Mo) téléchargé au 1er appel dans .fastembed/ (pré-téléchargé dans l'image Docker).
        return TextEmbedding(model_name=EMBED_MODEL, cache_dir=str(ROOT / ".fastembed"))
    except Exception as e:  # pas installé, pas de réseau pour télécharger le modèle...
        print(f"[embeddings] désactivés : {e}")
        return None


def embed(texts: list[str]) -> list[list[float]] | None:
    model = _model()
    if model is None or not texts:
        return None
    return [vec.tolist() for vec in model.embed(texts)]
