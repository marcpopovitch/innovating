// Démo « Ciceron apprend » : analyse → un juriste rejette une alerte (table feedback) → nouvelle analyse
// du même acte → avant/après. Le juge relit les retours proches via doctrine() (lib/agents/roles.ts).
//
// Usage : npm run demo:learning -- [id d'un cas de bench/cases.json] ["motif du rejet"]
// Exemple : npm run demo:learning -- tabac-ecoles "Faux positif : l'arrêté rappelle la règle pour l'afficher aux écoles."
import { existsSync, readFileSync } from "node:fs";

if (existsSync(".env")) process.loadEnvFile(".env");
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

interface Case { id: string; title: string; date_acte: string; input: string }
interface Row { id: string; verdict: string; severity: string; title: string; verified: boolean; disposition: { id: string; text: string; objet: string } }

async function main() {
  // Imports après le chargement de .env : la base (Aiven ou PGlite) est choisie à l'import.
  const { db } = await import("../lib/db");
  const { createAnalysis, runAnalysis } = await import("../lib/agents/orchestrator");
  const { doctrine } = await import("../lib/agents/roles");
  const { hasLlmKey } = await import("../lib/agents/llm");
  if (!hasLlmKey()) throw new Error("Aucune clé de modèle (ANTHROPIC_API_KEY, OPENAI_API_KEY ou OPENROUTER_API_KEY).");

  const [caseId = "tabac-ecoles", motif = "Faux positif selon le service juridique : ne pas relever cette alerte sur ce type de mesure."] = process.argv.slice(2);
  const c = (JSON.parse(readFileSync("bench/cases.json", "utf8")) as Case[]).find((x) => x.id === caseId);
  if (!c) throw new Error(`Cas « ${caseId} » introuvable dans bench/cases.json`);
  const client = await db();

  const analyse = async (label: string) => {
    console.log(`\n→ ${label} : analyse de « ${c.title} »…`);
    const id = await createAnalysis({ title: c.title, input: c.input, collectivite: null, date_acte: c.date_acte });
    await runAnalysis(id);
    const { rows } = await client.query<Row>("select id, verdict, severity, title, verified, disposition from findings where analysis_id = $1 order by created_at", [id]);
    for (const f of rows) console.log(`   ${f.verified ? "ALERTE" : "écartée"} [${f.verdict}/${f.severity}] ${f.title}  (${f.disposition.id})`);
    return rows;
  };

  // 1. Première analyse
  const before = await analyse("AVANT");
  const target = before.find((f) => f.verified && f.verdict !== "conforme");
  if (!target) {
    console.log("\nAucune alerte retenue : rien à rejeter. Essaie un autre cas (ex. couvre-feu-general).");
    process.exit(0);
  }

  // 2. Le juriste rejette l'alerte (même écriture que POST /api/feedback)
  await client.query("insert into feedback (finding_id, decision, reason, disposition_text, finding_verdict) values ($1, 'rejete', $2, $3, $4)", [
    target.id,
    motif,
    target.disposition.text,
    target.verdict,
  ]);
  console.log(`\n✗ Feedback enregistré : alerte « ${target.title} » REJETÉE — motif : ${motif}`);
  const injected = await doctrine(target.disposition as never);
  console.log(injected ? `\nCe que le juge lira à la prochaine analyse :${injected}` : "\n(aucune doctrine retrouvée pour cette disposition : vérifier la recherche plein texte)");

  // 3. Nouvelle analyse du même acte
  const after = await analyse("APRÈS");

  // 4. Avant / après sur la disposition visée
  const same = (f: Row) => f.disposition.text === target.disposition.text || f.disposition.objet === target.disposition.objet;
  const afterAlert = after.find((f) => same(f) && f.verified && f.verdict !== "conforme");
  const afterAny = after.find(same);
  console.log("\n================ AVANT / APRÈS ================");
  console.log(`Disposition : ${target.disposition.text.slice(0, 140)}`);
  console.log(`Avant : ALERTE ${target.verdict} (${target.severity}) — ${target.title}`);
  if (!afterAlert) console.log(`Après : alerte disparue${afterAny ? ` (${afterAny.verdict}${afterAny.verified ? "" : ", écartée"})` : ""} ✓`);
  else if (afterAlert.verdict !== target.verdict) console.log(`Après : requalifiée en ${afterAlert.verdict} (${afterAlert.severity}) — ${afterAlert.title} ✓`);
  else console.log(`Après : alerte maintenue (${afterAlert.verdict}) — le juge n'a pas suivi la doctrine sur ce cas.`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
