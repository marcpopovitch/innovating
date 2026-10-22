// Complète la pyramide des normes :
//  1. bloc de constitutionnalité + 6 codes supplémentaires (dump DILA LEGI + incréments) ;
//  2. international / UE : CEDH, Charte des droits fondamentaux de l'UE, directive Services ;
//  3. jurisprudence administrative : décisions du Conseil d'État (open data, depuis 2021).
// Usage : npm run ingest:hierarchie
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CODES, CONSTITUTION } from "../lib/codes";
import { db } from "../lib/db";
import { htmlToText } from "../lib/dila";
import { ingestLegi } from "./ingest-legi";

const DATA = join(process.cwd(), ".data");
const NEW_IDS = [...Object.keys(CONSTITUTION), ...Object.keys(CODES).slice(9)];

interface Row {
  id: string;
  code_id: string;
  code_title: string;
  num: string;
  section: string | null;
  text: string;
  date_debut: string | null;
  niveau: "international" | "jurisprudence";
  url: string;
}

async function upsert(rows: Row[]) {
  const client = await db();
  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200);
    const values: unknown[] = [];
    const tuples = chunk.map((r, j) => {
      values.push(r.id, r.code_id, r.code_title, r.num, r.section, r.text, r.date_debut, r.niveau, r.url);
      const o = j * 9;
      return `($${o + 1}, $${o + 2}, $${o + 3}, $${o + 4}, $${o + 5}, $${o + 6}, 'VIGUEUR', $${o + 7}, $${o + 8}, $${o + 9})`;
    });
    await client.query(
      `insert into articles (id, code_id, code_title, num, section, text, etat, date_debut, niveau, url) values ${tuples.join(",")}
       on conflict (id) do update set text = excluded.text, section = excluded.section, niveau = excluded.niveau, url = excluded.url`,
      values,
    );
  }
}

/** Découpe un texte en articles à partir d'un motif de titre d'article. */
function splitArticles(text: string, heading: RegExp): Array<{ num: string; title: string; body: string }> {
  const parts = text.split(heading);
  const out: Array<{ num: string; title: string; body: string }> = [];
  for (let i = 1; i < parts.length; i += 2) {
    const lines = parts[i + 1].trim().split("\n");
    const title = lines[0].length < 120 && !/[.;:]$/.test(lines[0]) ? lines.shift()!.trim() : "";
    const body = lines.join("\n").replace(/\n{2,}/g, "\n").trim();
    if (body.length > 20) out.push({ num: parts[i] === "premier" ? "1" : parts[i], title, body });
  }
  return out;
}

async function fetchTo(url: string, path: string, headers: Record<string, string> = {}) {
  if (existsSync(path)) return;
  const res = await fetch(url, { headers, redirect: "follow", signal: AbortSignal.timeout(90_000) });
  if (!res.ok) throw new Error(`${url} : HTTP ${res.status}`);
  writeFileSync(path, Buffer.from(await res.arrayBuffer()));
}

async function international(log: (m: string) => void) {
  const dir = join(DATA, "intl");
  mkdirSync(dir, { recursive: true });
  const rows: Row[] = [];

  // CEDH (PDF officiel de la Cour) ; -raw garde l'ordre de lecture malgré les deux colonnes.
  await fetchTo("https://www.echr.coe.int/documents/d/echr/convention_FRA", join(dir, "cedh.pdf"));
  execFileSync("pdftotext", ["-raw", join(dir, "cedh.pdf"), join(dir, "cedh_raw.txt")], { stdio: "ignore" });
  for (const a of splitArticles(readFileSync(join(dir, "cedh_raw.txt"), "utf8"), /^ARTICLE (\d+)\s*$/m))
    rows.push({ id: `CEDH-art-${a.num}`, code_id: "CEDH", code_title: "Convention européenne des droits de l'homme", num: `art. ${a.num}`, section: a.title || null, text: a.body, date_debut: "1974-05-03", niveau: "international", url: "https://www.echr.coe.int/documents/d/echr/convention_FRA" });

  // Charte des droits fondamentaux de l'UE (PDF du Parlement européen).
  await fetchTo("https://www.europarl.europa.eu/charter/pdf/text_fr.pdf", join(dir, "charte.pdf"));
  execFileSync("pdftotext", [join(dir, "charte.pdf"), join(dir, "charte.txt")], { stdio: "ignore" });
  for (const a of splitArticles(readFileSync(join(dir, "charte.txt"), "utf8"), /^Article (\d+)\s*$/m))
    rows.push({ id: `CDFUE-art-${a.num}`, code_id: "CDFUE", code_title: "Charte des droits fondamentaux de l'Union européenne", num: `art. ${a.num}`, section: a.title || null, text: a.body, date_debut: "2009-12-01", niveau: "international", url: "https://www.europarl.europa.eu/charter/pdf/text_fr.pdf" });

  // Directive 2006/123/CE « Services » (CELLAR : EUR-Lex bloque les lectures automatiques).
  await fetchTo("http://publications.europa.eu/resource/celex/32006L0123", join(dir, "32006L0123.html"), { accept: "text/html", "accept-language": "fr" });
  const directive = htmlToText(readFileSync(join(dir, "32006L0123.html"), "utf8").replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")).replace(/ /g, " ");
  for (const a of splitArticles(directive, /^\s*Article (premier|\d+)\s*$/m))
    rows.push({ id: `DIR2006-123-art-${a.num}`, code_id: "32006L0123", code_title: "Directive 2006/123/CE relative aux services dans le marché intérieur", num: `art. ${a.num}`, section: a.title || null, text: a.body.slice(0, 20_000), date_debut: "2006-12-28", niveau: "international", url: "https://eur-lex.europa.eu/legal-content/FR/TXT/?uri=CELEX:32006L0123" });

  await upsert(rows);
  log(`International / UE : ${rows.length} articles (CEDH, Charte UE, directive Services)`);
}

const tag = (xml: string, name: string) => xml.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`))?.[1]?.trim() ?? null;

async function jurisprudence(log: (m: string) => void) {
  const dir = join(DATA, "ja");
  mkdirSync(dir, { recursive: true });
  // Archives mensuelles du Conseil d'État, de septembre 2021 (début de l'open data) à aujourd'hui.
  const now = new Date();
  for (let d = new Date(2021, 8, 1); d <= now; d.setMonth(d.getMonth() + 1)) {
    const ym = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
    await fetchTo(`https://opendata.justice-administrative.fr/DCE/${d.getFullYear()}/${ym.slice(4)}/CE_${ym}.zip`, join(dir, `CE_${ym}.zip`)).catch(() => {});
  }
  let total = 0;
  for (const zip of readdirSync(dir).filter((f) => /^CE_\d{6}\.zip$/.test(f)).sort()) {
    const out = join(dir, zip.replace(".zip", ""));
    if (!existsSync(out)) execFileSync("unzip", ["-o", "-q", join(dir, zip), "-d", out]);
    const rows: Row[] = [];
    for (const file of readdirSync(out, { recursive: true }).map(String).filter((f) => f.endsWith(".xml"))) {
      const xml = readFileSync(join(out, file), "utf8");
      const ecli = tag(xml, "Numero_ECLI");
      const numero = tag(xml, "Numero_Dossier");
      const date = tag(xml, "Date_Lecture");
      const text = htmlToText(tag(xml, "Texte_Integral"));
      if (!ecli || !numero || !date || text.length < 200) continue;
      rows.push({
        id: ecli,
        code_id: "CE",
        code_title: "Conseil d'État",
        num: `n° ${numero} du ${date}`,
        section: [tag(xml, "Type_Decision"), tag(xml, "Solution"), tag(xml, "Formation_Jugement"), `publication ${tag(xml, "Code_Publication") ?? "?"}`].filter(Boolean).join(" · "),
        text: text.slice(0, 30_000),
        date_debut: date,
        niveau: "jurisprudence",
        url: `https://www.conseil-etat.fr/fr/arianeweb/CE/decision/${date}/${numero}`,
      });
    }
    await upsert(rows);
    total += rows.length;
  }
  log(`Jurisprudence : ${total} décisions du Conseil d'État`);
}

export async function ingestHierarchy(log: (m: string) => void = console.log, closeAtEnd = true) {
  log(`Niveau 1 et 2 : ${NEW_IDS.length} textes (bloc de constitutionnalité + codes supplémentaires)`);
  await ingestLegi(undefined, "all", log, false, NEW_IDS, "_v2");
  await international(log);
  await jurisprudence(log);
  const client = await db();
  log(JSON.stringify((await client.query("select niveau, count(*)::int n from articles where etat = 'VIGUEUR' group by 1 order by 2 desc")).rows));
  if (closeAtEnd) await client.close();
}

if (process.argv[1]?.endsWith("ingest-hierarchy.ts")) ingestHierarchy().catch((error) => {
  console.error(error);
  process.exit(1);
});
