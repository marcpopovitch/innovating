FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Pré-télécharge le modèle d'embeddings pour éviter l'attente au 1er appel.
RUN python -c "from backend.embeddings import embed; embed(['warmup'])"

# Toute la config passe par les variables d'environnement (voir .env.example).
EXPOSE 8000
CMD ["sh", "-c", "uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
