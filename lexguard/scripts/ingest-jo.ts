// Flux du Journal officiel : télécharge les incréments quotidiens JORF de la DILA
// (gratuits, sans clé) et insère chaque texte paru. Usage : npm run ingest:jo -- [nombre de fichiers]
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { db } from "../lib/db";
import { parseArticle, parseTexteVersion } from "../lib/dila";

const BASE = "https://echanges.dila.gouv.fr/OPENDATA/JORF/";
// Dossier de travail séparable : deux imports simultanés ne se marchent pas dessus.
const DIR = process.env.LEXGUARD_JO_DIR ?? join(process.cwd(), ".data", "dila", "jorf");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith(".xml")) out.push(p);
  }
  return out;
}

/**
 * `since` (AAAAMMJJ) : prend tous les fichiers depuis cette date au lieu des `count` derniers.
 * `cleanup` : supprime l'archive et l'extraction une fois lues (historique long, disque limité).
 */
export async function ingestJo(count = 3, log = console.log, opts: { since?: string; until?: string; cleanup?: boolean } = {}) {
  mkdirSync(DIR, { recursive: true });
  const listing = await (await fetch(BASE)).text();
  const files = [...new Set([...listing.matchAll(/JORF_\d{8}-\d{6}\.tar\.gz/g)].map((m) => m[0]))].sort();
  const picked = opts.since ? files.filter((f) => f.slice(5, 13) >= opts.since! && (!opts.until || f.slice(5, 13) < opts.until)) : files.slice(-count);
  const client = await db();
  let inserted = 0;

  for (const file of picked) {
    const archive = join(DIR, file);
    const out = join(DIR, file.replace(".tar.gz", ""));
    if (!existsSync(archive)) writeFileSync(archive, Buffer.from(await (await fetch(BASE + file)).arrayBuffer()));
    if (!existsSync(out)) {
      mkdirSync(out, { recursive: true });
      execFileSync("tar", ["-xzf", archive, "-C", out]);
    }
    const xmls = walk(out);
    // Le texte d'un JO est éclaté en articles : on les regroupe par texte parent.
    const bodies = new Map<string, string[]>();
    for (const path of xmls.filter((p) => p.includes("/article/"))) {
      const a = parseArticle(readFileSync(path, "utf8"));
      if (!a?.content) continue;
      const parts = bodies.get(a.text_id) ?? [];
      parts.push(a.num ? `Article ${a.num}\n${a.content}` : a.content);
      bodies.set(a.text_id, parts);
    }
    const rows: unknown[][] = [];
    for (const path of xmls.filter((p) => p.includes("/texte/version/"))) {
      const t = parseTexteVersion(readFileSync(path, "utf8"));
      if (!t?.title) continue;
      const modifies = t.liens
        .filter((l) => l.nature === "CODE" || l.type === "MODIFIE" || l.id.startsWith("LEGIARTI"))
        .map((l) => ({ id: l.id, type: l.type, title: l.title }));
      const text = [t.visas, ...(bodies.get(t.id) ?? [])].filter(Boolean).join("\n\n").slice(0, 60_000);
      rows.push([t.id, t.nature, t.title, t.nor, t.date_publi, text, JSON.stringify(modifies), file]);
    }
    // Par paquets : vers une base distante (Aiven), un aller-retour par texte serait le goulot.
    for (let i = 0; i < rows.length; i += 100) {
      const chunk = rows.slice(i, i + 100);
      const res = await client.query(
        `insert into jo_texts (id, nature, title, nor, date_publi, text, modifies, source_file)
         values ${chunk.map((_, j) => `(${Array.from({ length: 8 }, (_, k) => `$${j * 8 + k + 1}`).join(", ")})`).join(", ")}
         on conflict (id) do nothing returning id`,
        chunk.flat(),
      );
      inserted += res.rows.length;
    }
    log(`${file} : ${xmls.length} fichiers XML lus`);
    if (opts.cleanup) {
      rmSync(out, { recursive: true, force: true });
      rmSync(archive, { force: true });
    }
  }
  log(`${inserted} nouveaux textes du JO insérés`);
  return inserted;
}

// npm run ingest:jo -- 3            → les 3 derniers fichiers
// npm run ingest:jo -- 20260101 [20260401] → tout depuis cette date [jusqu'à celle-ci exclue], fichiers supprimés après lecture
if (process.argv[1]?.endsWith("ingest-jo.ts")) {
  if (existsSync(".env")) process.loadEnvFile(".env"); // DATABASE_URL : écrit directement dans Aiven
  const arg = process.argv[2] ?? "3";
  ingestJo(Number(arg), console.log, arg.length === 8 ? { since: arg, until: process.argv[3], cleanup: true } : {}).then(() => process.exit(0));
}
