// Flux du Journal officiel : télécharge les incréments quotidiens JORF de la DILA
// (gratuits, sans clé) et insère chaque texte paru. Usage : npm run ingest:jo -- [nombre de fichiers]
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { db } from "../lib/db";
import { parseArticle, parseTexteVersion } from "../lib/dila";

const BASE = "https://echanges.dila.gouv.fr/OPENDATA/JORF/";
const DIR = join(process.cwd(), ".data", "dila", "jorf");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith(".xml")) out.push(p);
  }
  return out;
}

export async function ingestJo(count = 3, log = console.log) {
  mkdirSync(DIR, { recursive: true });
  const listing = await (await fetch(BASE)).text();
  const files = [...new Set([...listing.matchAll(/JORF_\d{8}-\d{6}\.tar\.gz/g)].map((m) => m[0]))].sort().slice(-count);
  const client = await db();
  let inserted = 0;

  for (const file of files) {
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
    for (const path of xmls.filter((p) => p.includes("/texte/version/"))) {
      const t = parseTexteVersion(readFileSync(path, "utf8"));
      if (!t?.title) continue;
      const modifies = t.liens
        .filter((l) => l.nature === "CODE" || l.type === "MODIFIE" || l.id.startsWith("LEGIARTI"))
        .map((l) => ({ id: l.id, type: l.type, title: l.title }));
      const text = [t.visas, ...(bodies.get(t.id) ?? [])].filter(Boolean).join("\n\n").slice(0, 60_000);
      const { rows } = await client.query(
        `insert into jo_texts (id, nature, title, nor, date_publi, text, modifies, source_file)
         values ($1, $2, $3, $4, $5, $6, $7, $8)
         on conflict (id) do nothing returning id`,
        [t.id, t.nature, t.title, t.nor, t.date_publi, text, JSON.stringify(modifies), file],
      );
      inserted += rows.length;
    }
    log(`${file} : ${xmls.length} fichiers XML lus`);
  }
  log(`${inserted} nouveaux textes du JO insérés`);
  return inserted;
}

if (process.argv[1]?.endsWith("ingest-jo.ts")) {
  ingestJo(Number(process.argv[2] ?? 3)).then(() => process.exit(0));
}
