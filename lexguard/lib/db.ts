// Une seule interface SQL : Aiven PostgreSQL si DATABASE_URL est défini,
// sinon PGlite (Postgres embarqué, fichier local) pour développer sans rien installer.
import { readFileSync } from "node:fs";
import { join } from "node:path";

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
  const lite = await PGlite.create(dir === "memory://" ? undefined : dir, { extensions: { pg_trgm } });
  return {
    query: (sql, params) => lite.query(sql, params) as never,
    exec: async (sql) => void (await lite.exec(sql)),
    close: () => lite.close(),
  };
}

// Un seul client par processus (Next.js recharge les modules en dev : on accroche à globalThis).
const globalDb = globalThis as unknown as { __lexguardDb?: Promise<Db> };

export function db(): Promise<Db> {
  globalDb.__lexguardDb ??= connect().then(async (client) => {
    await client.exec(readFileSync(join(process.cwd(), "db", "schema.sql"), "utf8"));
    return client;
  });
  return globalDb.__lexguardDb;
}

/** Exécute une requête et la trace dans query_log (livrable « data layer in action »). */
export async function tracedQuery<T = Record<string, unknown>>(actor: string, kind: string, detail: string, sql: string, params: unknown[] = []): Promise<T[]> {
  const client = await db();
  const t0 = Date.now();
  const { rows } = await client.query<T>(sql, params);
  await client.query("insert into query_log (actor, kind, detail, rows, ms) values ($1, $2, $3, $4, $5)", [actor, kind, detail.slice(0, 500), rows.length, Date.now() - t0]);
  return rows;
}
