// Une seule interface SQL : Aiven PostgreSQL si DATABASE_URL est défini,
// sinon PGlite (Postgres embarqué, fichier local) pour développer sans rien installer.
import { existsSync, mkdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export interface Db {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
  exec(sql: string): Promise<void>;
  close(): Promise<void>;
}

async function connect(): Promise<Db> {
  if (process.env.DATABASE_URL) {
    const { Pool } = await import("pg");
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL.includes("sslmode=disable") ? false : { rejectUnauthorized: false },
      max: 10,
    });
    return {
      query: async (sql, params) => pool.query(sql, params as unknown[]) as never,
      exec: async (sql) => void (await pool.query(sql)),
      close: () => pool.end(),
    };
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const { pg_trgm } = await import("@electric-sql/pglite/contrib/pg_trgm");
  const dir = process.env.PGLITE_DIR ?? join(process.cwd(), ".data", "pglite");
  if (dir !== "memory://") acquireLock(dir);
  const lite = await PGlite.create(dir === "memory://" ? undefined : dir, { extensions: { pg_trgm } });
  return {
    query: (sql, params) => lite.query(sql, params) as never,
    exec: async (sql) => void (await lite.exec(sql)),
    close: () => lite.close(),
  };
}

// PGlite n'accepte qu'un processus à la fois sur un même dossier : un second ouvreur
// (ex. `npm run dev` pendant un import) l'abîmerait. On pose un verrou explicite.
function acquireLock(dir: string) {
  const lock = `${dir}.lock`;
  if (existsSync(lock)) {
    const pid = Number(readFileSync(lock, "utf8"));
    let alive = false;
    try {
      process.kill(pid, 0); // signal 0 : teste seulement l'existence du processus
      alive = pid !== process.pid;
    } catch {}
    if (alive) throw new Error(`Base locale occupée par un autre programme (pid ${pid}, sans doute un import). Attendez sa fin, ou utilisez DATABASE_URL (Aiven).`);
  }
  mkdirSync(dirname(lock), { recursive: true });
  writeFileSync(lock, String(process.pid));
  process.once("exit", () => {
    try {
      if (readFileSync(lock, "utf8") === String(process.pid)) unlinkSync(lock);
    } catch {}
  });
}

// Un seul client par processus (Next.js recharge les modules en dev : on accroche à globalThis).
// Le schéma (idempotent) est réappliqué dès que db/schema.sql change, sans redémarrer le serveur.
const globalDb = globalThis as unknown as { __lexguardDb?: Promise<Db>; __lexguardSchema?: number };
const SCHEMA = () => join(process.cwd(), "db", "schema.sql");

export async function db(): Promise<Db> {
  globalDb.__lexguardDb ??= connect();
  const client = await globalDb.__lexguardDb;
  const mtime = statSync(SCHEMA()).mtimeMs;
  if (globalDb.__lexguardSchema !== mtime) {
    globalDb.__lexguardSchema = mtime;
    await client.exec(readFileSync(SCHEMA(), "utf8"));
  }
  return client;
}

/** Exécute une requête et la trace dans query_log (livrable « data layer in action »). */
export async function tracedQuery<T = Record<string, unknown>>(actor: string, kind: string, detail: string, sql: string, params: unknown[] = []): Promise<T[]> {
  const client = await db();
  const t0 = Date.now();
  const { rows } = await client.query<T>(sql, params);
  await client.query("insert into query_log (actor, kind, detail, rows, ms) values ($1, $2, $3, $4, $5)", [actor, kind, detail.slice(0, 500), rows.length, Date.now() - t0]);
  return rows;
}
