// Livrable « The data layer in action » : état du corpus, fraîcheur, et requêtes
// réelles des agents, extraits de la base. Usage : npm run data-layer > bench/data-layer.txt
import { db } from "../lib/db";

async function main() {
  const c = await db();
  const q = async (sql: string) => (await c.query(sql)).rows;
  const line = (s = "") => console.log(s);
  line("CICERON — LA COUCHE DE DONNÉES EN ACTION");
  line(`Généré le ${new Date().toISOString()} · base : ${process.env.DATABASE_URL ? "Aiven PostgreSQL" : "PGlite (Postgres local)"}`);
  line();
  line("1. CORPUS (dump DILA LEGI + incréments quotidiens, toutes versions datées)");
  for (const r of await q("select code_title, count(*) filter (where etat = 'VIGUEUR')::int en_vigueur, count(*)::int versions from articles group by 1 order by 2 desc"))
    line(`   ${String(r.code_title).padEnd(58)} ${String(r.en_vigueur).padStart(7)} en vigueur  ${String(r.versions).padStart(7)} versions`);
  const [m] = await q("select (select count(*) from links)::int liens, (select value from meta where key = 'legi_a_jour_au') a_jour");
  line(`   Graphe des normes : ${m.liens} liens (cite, modifie, codifie…) · corpus à jour au ${m.a_jour ?? "?"}`);
  line();
  line("2. FLUX DU JOURNAL OFFICIEL (incréments JORF quotidiens)");
  for (const r of await q("select date_publi::text d, count(*)::int n from jo_texts where date_publi is not null group by 1 order by 1 desc limit 5")) line(`   ${r.d} : ${r.n} textes`);
  line();
  line("3. MÉMOIRE DES COLLECTIVITÉS (actes open data SCDL + actes analysés)");
  for (const r of await q("select collectivite, count(*)::int n, count(text)::int t from local_acts group by 1 order by 2 desc")) line(`   ${String(r.collectivite).padEnd(40)} ${r.n} actes (${r.t} avec texte intégral)`);
  line();
  line("4. VEILLE : ACTES LOCAUX TOUCHÉS PAR UN TEXTE RÉCENT DU JO");
  for (const r of await q("select left(j.title, 90) jo, v.collectivite, left(v.act_title, 80) acte, v.reason from veille_impacts v join jo_texts j on j.id = v.jo_id limit 8"))
    line(`   ${r.jo}\n     → ${r.collectivite} : ${r.acte}\n       ${r.reason}`);
  line();
  line("5. APPRENTISSAGE : RETOURS DES JURISTES RÉINJECTÉS DANS LE JUGE");
  for (const r of await q("select decision, finding_verdict, left(disposition_text, 90) d, reason from feedback order by id desc limit 5")) line(`   [${r.decision}] ${r.finding_verdict} — ${r.d}${r.reason ? ` (${r.reason})` : ""}`);
  line();
  line("6. REQUÊTES RÉELLES DES AGENTS (query_log, les plus récentes)");
  for (const r of await q("select to_char(ts, 'HH24:MI:SS') t, actor, kind, detail, rows, ms from query_log order by id desc limit 30"))
    line(`   ${r.t}  ${String(r.actor).padEnd(16)} ${String(r.kind).padEnd(26)} ${String(r.rows).padStart(3)} lignes ${String(r.ms).padStart(5)} ms  ${r.detail}`);
  await c.close();
}
main();
