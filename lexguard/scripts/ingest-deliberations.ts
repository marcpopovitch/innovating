// Mémoire des collectivités : actes réels publiés en open data au format SCDL
// (délibérations et arrêtés, texte intégral quand il est fourni).
import { db } from "../lib/db";

interface Source {
  collectivite?: string;
  url: string; // export JSON Opendatasoft
}

const SOURCES: Source[] = [
  { url: "https://data.grandparissud.fr/api/explore/v2.1/catalog/datasets/actes-administratifs-de-grand-paris-sud-format-scdl/exports/json" },
  { url: "https://data.evrycourcouronnes.fr/api/explore/v2.1/catalog/datasets/deliberations0/exports/json" },
  { url: "https://data.issy.com/api/explore/v2.1/catalog/datasets/deliberations-2025/exports/json" },
];

type Row = Record<string, unknown>;
const pick = (r: Row, ...keys: string[]) => keys.map((k) => r[k]).find((v) => v != null && v !== "");
const url = (v: unknown) => (typeof v === "string" ? v : (v as { url?: string } | undefined)?.url ?? null);

async function main() {
  const client = await db();
  for (const source of SOURCES) {
    const rows = (await (await fetch(source.url)).json()) as Row[];
    let n = 0;
    for (let i = 0; i < rows.length; i += 200) {
      const chunk = rows.slice(i, i + 200).filter((r) => pick(r, "delib_objet", "objet"));
      if (!chunk.length) continue;
      const values: unknown[] = [];
      const tuples = chunk.map((r, j) => {
        const date = String(pick(r, "date_delib", "delib_date", "date_signature", "annee") ?? "").slice(0, 10) || null;
        const type = pick(r, "type_actes", "code_instance");
        values.push(
          source.collectivite ?? String(pick(r, "coll_nom") ?? "Collectivité"),
          `${type ? `${type} — ` : ""}${pick(r, "delib_objet", "objet")}`.slice(0, 500),
          date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null,
          typeof r.contenu === "string" ? r.contenu.slice(0, 20_000) : null,
          url(pick(r, "delib_url")),
          "open data SCDL",
        );
        return `($${j * 6 + 1}, $${j * 6 + 2}, $${j * 6 + 3}, $${j * 6 + 4}, $${j * 6 + 5}, $${j * 6 + 6})`;
      });
      await client.query(`insert into local_acts (collectivite, title, date_acte, text, url, source) values ${tuples.join(",")}`, values);
      n += chunk.length;
    }
    console.log(`${source.url.split("/datasets/")[1].split("/")[0]} : ${n} actes`);
  }
  console.table((await client.query("select collectivite, count(*)::int n, count(text)::int avec_texte from local_acts group by 1 order by 2 desc")).rows);
  await client.close();
}
main();
