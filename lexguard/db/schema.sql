-- Schéma Ciceron. Compatible PostgreSQL 16+ (Aiven) et PGlite (local).
create extension if not exists pg_trgm;

-- Corpus : articles de codes (dump DILA LEGI), toutes versions datées.
create table if not exists articles (
  id          text primary key,           -- LEGIARTI…
  cid         text,                       -- identifiant commun aux versions
  code_id     text not null,              -- LEGITEXT…
  code_title  text not null,
  num         text,                       -- ex. L2212-2
  section     text,                       -- titres de sections, du plus large au plus fin
  text        text not null,
  etat        text not null,              -- VIGUEUR, ABROGE, MODIFIE…
  date_debut  date,
  date_fin    date,
  tsv         tsvector generated always as (
                to_tsvector('french', coalesce(num, '') || ' ' || coalesce(section, '') || ' ' || text)
              ) stored
);
create index if not exists articles_tsv on articles using gin (tsv);
create index if not exists articles_num on articles (code_id, num);
create index if not exists articles_cid on articles (cid);

-- Graphe des normes : liens déclarés par la DILA (cite, modifie, codifie…).
create table if not exists links (
  src        text not null,
  dst        text not null,
  type       text not null,
  sens       text,                        -- source | cible
  dst_title  text,
  primary key (src, dst, type)
);
create index if not exists links_dst on links (dst);

-- Flux : textes parus au Journal officiel (incréments quotidiens DILA JORF).
create table if not exists jo_texts (
  id          text primary key,           -- JORFTEXT…
  nature      text,
  title       text not null,
  nor         text,
  date_publi  date,
  text        text,
  modifies    jsonb not null default '[]', -- articles visés (LEGIARTI / numéros)
  source_file text,
  ingested_at timestamptz not null default now(),
  tsv         tsvector generated always as (to_tsvector('french', title || ' ' || coalesce(text, ''))) stored
);
create index if not exists jo_texts_tsv on jo_texts using gin (tsv);

-- Mémoire des collectivités : leurs actes (délibérations SCDL, arrêtés analysés).
create table if not exists local_acts (
  id            bigserial primary key,
  collectivite  text not null,
  title         text not null,
  date_acte     date,
  text          text,
  url           text,
  source        text not null,
  tsv           tsvector generated always as (to_tsvector('french', title || ' ' || coalesce(text, ''))) stored
);
create index if not exists local_acts_tsv on local_acts using gin (tsv);

create table if not exists analyses (
  id            uuid primary key,
  kind          text not null,              -- acte | jo
  title         text not null,
  input         text not null,
  collectivite  text,
  date_acte     date,
  status        text not null default 'en_cours', -- en_cours | termine | erreur
  summary       jsonb,
  cost_usd      numeric,
  latency_ms    integer,
  created_at    timestamptz not null default now(),
  finished_at   timestamptz
);

-- Journal des étapes des agents, relu par le flux SSE de l'interface.
create table if not exists events (
  id           bigserial primary key,
  analysis_id  uuid not null,
  ts           timestamptz not null default now(),
  agent        text not null,
  type         text not null,              -- etape | outil | resultat | rejet | erreur | fin
  message      text not null,
  data         jsonb
);
create index if not exists events_analysis on events (analysis_id, id);

create table if not exists findings (
  id                uuid primary key,
  analysis_id       uuid not null,
  disposition       jsonb not null,
  verdict           text not null,          -- conflit | doublon | vide | incompetence | conforme
  severity          text not null,          -- critique | majeure | mineure | info
  title             text not null,
  explanation       text not null,
  citations         jsonb not null,         -- [{article_id, num, code, quote, url}]
  suggestion        text,
  verified          boolean not null default false,
  rejection_reason  text,
  created_at        timestamptz not null default now()
);
create index if not exists findings_analysis on findings (analysis_id);

-- Apprentissage : retours des juristes, réinjectés comme doctrine interne.
create table if not exists feedback (
  id               bigserial primary key,
  finding_id       uuid not null,
  decision         text not null,           -- valide | rejete
  reason           text,
  disposition_text text not null,
  finding_verdict  text not null,
  created_at       timestamptz not null default now(),
  tsv              tsvector generated always as (to_tsvector('french', disposition_text || ' ' || coalesce(reason, ''))) stored
);
create index if not exists feedback_tsv on feedback using gin (tsv);

-- Couche de données en action : chaque requête d'agent est tracée.
create table if not exists query_log (
  id      bigserial primary key,
  ts      timestamptz not null default now(),
  actor   text not null,
  kind    text not null,
  detail  text not null,
  rows    integer,
  ms      integer
);

-- Métadonnées de fraîcheur (date du dernier incrément LEGI appliqué…).
create table if not exists meta (
  key   text primary key,
  value text not null
);

-- Veille : actes locaux touchés par un texte paru au JO.
create table if not exists veille_impacts (
  jo_id         text not null,
  collectivite  text not null,
  act_title     text not null,
  reason        text not null,
  created_at    timestamptz not null default now(),
  primary key (jo_id, collectivite, act_title)
);

-- Conversation : mode (contrôle / exploration), modèle choisi, réponses de cadrage.
alter table analyses add column if not exists mode text not null default 'controle';
alter table analyses add column if not exists model text not null default 'claude-opus-5-5';
alter table analyses add column if not exists cadrage jsonb;

-- Pyramide des normes : niveau de chaque texte et lien vers la source officielle.
alter table articles add column if not exists niveau text not null default 'code';
alter table articles add column if not exists url text;
create index if not exists articles_niveau on articles (niveau);
