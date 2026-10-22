// Copie la base locale (PGlite, .data/pglite) vers Aiven PostgreSQL (DATABASE_URL).
// À lancer serveur de dev arrêté (PGlite n'accepte qu'un processus) : npm run migrate:aiven
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { Pool } from "pg";

// Tables à copier, avec leur clé de pagination (lecture par tranches, sans OFFSET).
// Les colonnes générées (tsv) sont recalculées par Aiven, on ne les copie pas.
const TABLES: Array<{ name: string; key: string[] }> = [
  { name: "meta", key: ["key"] },
  { name: "articles", key: ["id"] },
  { name: "links", key: ["src", "dst", "type"] },
  { name: "jo_texts", key: ["id"] },
  { name: "local_acts", key: ["id"] },
  { name: "veille_impacts", key: ["jo_id", "collectivite", "act_title"] },
  { name: "analyses", key: ["id"] },
  { name: "events", key: ["id"] },
  { name: "findings", key: ["id"] },
  { name: "feedback", key: ["id"] },
];
const BATCH = 500;

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL (Aiven) manquante dans .env");
  const lite = await PGlite.create(join(process.cwd(), ".data", "pglite"), { extensions: { pg_trgm } });
  const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, max: 4 });
  await pool.query(readFileSync(join(process.cwd(), "db", "schema.sql"), "utf8"));

  for (const { name, key } of TABLES) {
    const cols = (
      await lite.query<{ column_name: string }>(
        "select column_name from information_schema.columns where table_name = $1 and is_generated = 'NEVER' order by ordinal_position",
        [name],
      )
    ).rows.map((r) => r.column_name);
    const serial = (await lite.query<{ c: string | null }>(`select pg_get_serial_sequence($1, 'id') as c`, [name]).catch(() => ({ rows: [{ c: null }] }))).rows[0]?.c;
    const total = Number((await lite.query<{ n: number }>(`select count(*)::int n from ${name}`)).rows[0].n);
    let last: unknown[] | null = null;
    let copied = 0;
    const t0 = Date.now();
    for (;;) {
      const where: string = last ? `where (${key.join(", ")}) > (${key.map((_, i) => `$${i + 1}`).join(", ")})` : "";
      const { rows }: { rows: Array<Record<string, unknown>> } = await lite.query<Record<string, unknown>>(`select ${cols.join(", ")} from ${name} ${where} order by ${key.join(", ")} limit ${BATCH}`, last ?? []);
      if (!rows.length) break;
      const values: unknown[] = [];
      const tuples = rows.map((r, i) => {
        cols.forEach((c) => values.push(r[c] !== null && typeof r[c] === "object" && !(r[c] instanceof Date) ? JSON.stringify(r[c]) : r[c]));
        return `(${cols.map((_, j) => `$${i * cols.length + j + 1}`).join(", ")})`;
      });
      await pool.query(`insert into ${name} (${cols.join(", ")}) values ${tuples.join(", ")} on conflict do nothing`, values);
      copied += rows.length;
      last = key.map((k) => rows[rows.length - 1][k]);
      if (copied % 50_000 < BATCH) console.log(`  ${name} : ${copied}/${total}`);
    }
    // Les identifiants auto-incrémentés repartent après le dernier copié.
    if (serial) await pool.query(`select setval($1, greatest((select coalesce(max(id), 0) from ${name}), 1))`, [serial]);
    console.log(`${name} : ${copied} lignes en ${Math.round((Date.now() - t0) / 1000)} s`);
  }
  await lite.close();
  await pool.end();
  console.log("Migration terminée : relancez le serveur, il utilisera Aiven (DATABASE_URL).");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
