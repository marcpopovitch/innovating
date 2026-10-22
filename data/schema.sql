-- Schéma de la base (Aiven PostgreSQL + pgvector).
-- Appliqué par : python -m data.load_harmonic --init
-- Idempotent : on peut le relancer sans casser l'existant.

-- pgvector est disponible sur Aiven PostgreSQL, il suffit de l'activer.
CREATE EXTENSION IF NOT EXISTS vector;

-- Une ligne par startup : venant de Harmonic, de l'échantillon de secours,
-- ou ajoutée à la volée depuis une URL collée dans l'interface.
CREATE TABLE IF NOT EXISTS startups (
    id                TEXT PRIMARY KEY,            -- id Harmonic, ou "dom:<domaine>" si ajoutée par URL
    name              TEXT NOT NULL,
    website           TEXT,
    linkedin_url      TEXT,
    sector            TEXT,                        -- sert de 1er niveau du treemap
    region            TEXT,                        -- Europe, North America, Asia...
    country           TEXT,
    city              TEXT,
    description       TEXT,
    stage             TEXT,
    founded_year      INT,
    headcount         INT,
    funding_total_usd NUMERIC,                     -- taille des cases du treemap (1 si inconnu)
    data_source       TEXT NOT NULL DEFAULT 'harmonic',  -- harmonic | sample | url
    raw               JSONB,                       -- réponse brute Harmonic, au cas où
    fetched_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Chaque page ou résultat web consulté. L'URL est unique : on ne garde
-- que la date de la dernière récupération.
CREATE TABLE IF NOT EXISTS sources (
    id         SERIAL PRIMARY KEY,
    url        TEXT UNIQUE NOT NULL,
    title      TEXT,
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Morceaux de texte des sources + leur embedding (384 dims = BAAI/bge-small-en-v1.5).
-- C'est ce que le chat interroge en premier (recherche vectorielle).
CREATE TABLE IF NOT EXISTS chunks (
    id         SERIAL PRIMARY KEY,
    startup_id TEXT REFERENCES startups(id) ON DELETE CASCADE,
    source_id  INT  REFERENCES sources(id)  ON DELETE CASCADE,
    content    TEXT NOT NULL,
    embedding  vector(384)                         -- NULL si les embeddings sont désactivés
);
CREATE INDEX IF NOT EXISTS chunks_startup_idx   ON chunks (startup_id);
CREATE INDEX IF NOT EXISTS chunks_embedding_idx ON chunks USING hnsw (embedding vector_cosine_ops);

-- Faits extraits par les sous-agents, un pod = une section du dashboard.
-- Règle d'or : pas de fait sans source_url ni fetched_at.
CREATE TABLE IF NOT EXISTS facts (
    id         SERIAL PRIMARY KEY,
    startup_id TEXT NOT NULL REFERENCES startups(id) ON DELETE CASCADE,
    pod        TEXT NOT NULL CHECK (pod IN ('market', 'team', 'product', 'icp')),
    content    TEXT NOT NULL,
    source_url TEXT NOT NULL,
    fetched_at TIMESTAMPTZ NOT NULL,               -- date de récupération de la source
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS facts_startup_pod_idx ON facts (startup_id, pod);

-- Historique du chat, par startup. "sources" = liste des URL citées dans la réponse.
CREATE TABLE IF NOT EXISTS messages (
    id         SERIAL PRIMARY KEY,
    startup_id TEXT NOT NULL REFERENCES startups(id) ON DELETE CASCADE,
    role       TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content    TEXT NOT NULL,
    sources    JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS messages_startup_idx ON messages (startup_id, created_at);
