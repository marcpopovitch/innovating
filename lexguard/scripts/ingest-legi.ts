// Corpus : extrait du dump DILA LEGI les articles (toutes versions) des codes utiles
// aux collectivités, puis applique les incréments quotidiens pour être à jour.
// Usage : npm run ingest:legi -- [chemin du dump .tar.gz] [nombre d'incréments]
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ALL_TEXTS } from "../lib/codes";
import { db } from "../lib/db";
import { type ParsedArticle, parseArticle } from "../lib/dila";

const DIR = join(process.cwd(), ".data", "dila");
const BASE = "https://echanges.dila.gouv.fr/OPENDATA/LEGI/";

function* walk(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (name.startsWith("LEGIARTI") && name.endsWith(".xml")) yield p;
  }
}

function extract(archive: string, out: string, ids: string[]) {
  mkdirSync(out, { recursive: true });
  // Codes (code_en_vigueur) comme textes non codifiés (TNC_en_vigueur : Constitution, DDHC…).
  const patterns = ids.flatMap((id) => ["--include", `*_en_vigueur*/${id}/article/*`]);
  try {
    execFileSync("tar", ["-xzf", archive, "-C", out, ...patterns], { stdio: "pipe", maxBuffer: 1 << 26 });
  } catch (error) {
    // Un incrément ne touche souvent qu'une partie des codes : tar sort en erreur pour les
    // motifs absents. Seule une autre erreur (archive corrompue…) doit arrêter l'import.
    const stderr = String((error as { stderr?: Buffer }).stderr ?? "");
    if (stderr.split("\n").some((l) => l.trim() && !/Not found in archive|Error exit delayed/.test(l))) throw error;
  }
}

async function insertBatch(batch: ParsedArticle[]) {
  if (!batch.length) return;
  const client = await db();
  const values: unknown[] = [];
  const rows = batch.map((a, i) => {
    const meta = ALL_TEXTS[a.text_id];
    values.push(a.id, a.cid, a.text_id, meta?.title ?? a.text_title, a.num, a.section, a.content, a.etat, a.date_debut, a.date_fin, meta?.niveau ?? "code");
    const o = i * 11;
    return `($${o + 1}, $${o + 2}, $${o + 3}, $${o + 4}, $${o + 5}, $${o + 6}, $${o + 7}, $${o + 8}, $${o + 9}, $${o + 10}, $${o + 11})`;
  });
  await client.query(
    `insert into articles (id, cid, code_id, code_title, num, section, text, etat, date_debut, date_fin, niveau) values ${rows.join(",")}
     on conflict (id) do update set text = excluded.text, etat = excluded.etat, date_debut = excluded.date_debut, date_fin = excluded.date_fin, section = excluded.section, niveau = excluded.niveau`,
    values,
  );
  const links = batch.flatMap((a) => a.liens.map((l) => [a.id, l.id, l.type, l.sens, l.num ? `${l.title}`.slice(0, 300) : l.title.slice(0, 300)]));
  for (let i = 0; i < links.length; i += 400) {
    const chunk = links.slice(i, i + 400);
    const params = chunk.flat();
    await client.query(
      `insert into links (src, dst, type, sens, dst_title) values ${chunk.map((_, j) => `($${j * 5 + 1}, $${j * 5 + 2}, $${j * 5 + 3}, $${j * 5 + 4}, $${j * 5 + 5})`).join(",")}
       on conflict do nothing`,
      params,
    );
  }
}

async function load(dir: string, log: (m: string) => void) {
  let batch: ParsedArticle[] = [];
  let n = 0;
  for (const path of walk(dir)) {
    const a = parseArticle(readFileSync(path, "utf8"));
    if (!a || !a.content || !ALL_TEXTS[a.text_id]) continue;
    batch.push(a);
    if (batch.length === 300) {
      await insertBatch(batch);
      n += batch.length;
      batch = [];
      if (n % 6000 === 0) log(`  ${n} articles…`);
    }
  }
  await insertBatch(batch);
  return n + batch.length;
}

export async function ingestLegi(
  dumpArg?: string,
  incrementsArg?: string,
  log: (m: string) => void = console.log,
  closeAtEnd = true,
  ids: string[] = Object.keys(ALL_TEXTS),
  tag = "", // suffixe des dossiers d'extraction (pour ajouter des textes sans tout refaire)
) {
  const dump = dumpArg ?? join(DIR, "legi_global.tar.gz");
  // « all » rejoue tous les incréments parus depuis le dump (le dump DILA date de juillet 2025).
  const increments = incrementsArg ?? "all";
  const out = join(DIR, `legi_codes${tag}`);
  if (!existsSync(join(out, ".done"))) {
    log(`Extraction de ${ids.length} textes depuis ${dump}…`);
    extract(dump, out, ids);
    writeFileSync(join(out, ".done"), new Date().toISOString());
  }
  if (!existsSync(join(out, ".loaded"))) {
    log(`Chargement du corpus…`);
    log(`${await load(out, log)} articles chargés depuis le dump`);
    writeFileSync(join(out, ".loaded"), new Date().toISOString());
  }

  // Incréments quotidiens postérieurs au dump : le corpus colle au droit du jour.
  const listing = await (await fetch(BASE)).text();
  const dumpStamp = dump.match(/(\d{8}-\d{6})/)?.[1] ?? "20250713-140000";
  const all = [...new Set([...listing.matchAll(/LEGI_\d{8}-\d{6}\.tar\.gz/g)].map((m) => m[0]))].sort().filter((f) => f.slice(5, 20) > dumpStamp);
  const files = increments === "all" ? all : all.slice(-Number(increments));
  log(`${files.length} incréments quotidiens à appliquer`);
  // Téléchargement en parallèle (8 à la fois), application dans l'ordre chronologique.
  mkdirSync(join(DIR, "legi_increments"), { recursive: true });
  const queue = files.filter((f) => !existsSync(join(DIR, "legi_increments", f)));
  const download = async (file: string) => {
    for (let attempt = 1; ; attempt++) {
      try {
        const res = await fetch(BASE + file, { signal: AbortSignal.timeout(120_000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const tmp = join(DIR, "legi_increments", `${file}.part`);
        writeFileSync(tmp, Buffer.from(await res.arrayBuffer()));
        renameSync(tmp, join(DIR, "legi_increments", file)); // jamais de fichier à moitié écrit
        return;
      } catch (error) {
        if (attempt >= 5) throw error;
        await new Promise((r) => setTimeout(r, 1000 * attempt));
      }
    }
  };
  let done = 0;
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      for (let file = queue.shift(); file; file = queue.shift()) {
        await download(file);
        if (++done % 50 === 0) log(`  ${done} incréments téléchargés…`);
      }
    }),
  );
  for (const file of files) {
    const archive = join(DIR, "legi_increments", file);
    const target = archive.replace(".tar.gz", tag);
    if (!existsSync(target)) extract(archive, target, ids);
    log(`${file} : ${await load(target, log)} articles mis à jour`);
    await (await db()).query("insert into meta (key, value) values ('legi_a_jour_au', $1) on conflict (key) do update set value = excluded.value", [`${file.slice(5, 9)}-${file.slice(9, 11)}-${file.slice(11, 13)}`]);
  }
  const client = await db();
  const { rows } = await client.query("select code_title, count(*) filter (where etat = 'VIGUEUR')::int en_vigueur, count(*)::int total from articles group by 1 order by 2 desc");
  log(JSON.stringify(rows));
  if (closeAtEnd) await client.close();
}

if (process.argv[1]?.endsWith("ingest-legi.ts")) ingestLegi(process.argv[2], process.argv[3]).catch((error) => {
  console.error(error);
  process.exit(1);
});
