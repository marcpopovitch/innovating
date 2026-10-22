// Benchmark avant/après sur des cas réels étiquetés (bench/cases.json).
// « Avant » : un seul appel à Claude, sans corpus ni outils (ce qu'un agent territorial ferait avec un chatbot).
// « Après » : l'équipe d'agents Ciceron sur le corpus DILA.
// Mesures : bon verdict, citations vérifiables, coût, latence. Usage : npm run bench
import { readFileSync, writeFileSync } from "node:fs";
import { z } from "zod";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { anthropic, CostMeter, FALLBACK, MODELS } from "../lib/agents/llm";
import { createAnalysis, runAnalysis } from "../lib/agents/orchestrator";
import { findByNum } from "../lib/agents/tools";
import { checkCitation } from "../lib/agents/verify";
import { db } from "../lib/db";
import type { Verdict } from "../lib/types";

interface Case { id: string; title: string; collectivite: string; date_acte: string; expected: Verdict; why: string; input: string }
interface Outcome { verdict: Verdict; citations: number; valid_citations: number; cost_usd: number; latency_ms: number }

const Baseline = z.object({
  verdict: z.enum(["conflit", "doublon", "vide", "incompetence", "conforme"]),
  citations: z.array(z.object({ code: z.string(), num: z.string().describe("ex. L2212-2"), quote: z.string().describe("extrait mot pour mot") })),
});

async function baseline(c: Case): Promise<Outcome> {
  const meter = new CostMeter();
  const t0 = Date.now();
  const res = await anthropic().beta.messages.parse({
    model: MODELS.deep,
    max_tokens: 8000,
    output_config: { effort: "high", format: betaZodOutputFormat(Baseline) },
    ...FALLBACK,
    system: "Tu es juriste en droit public. Qualifie la légalité de l'acte (conflit, doublon, vide, incompetence ou conforme) et cite les articles de code qui le prouvent, avec un extrait mot pour mot.",
    messages: [{ role: "user", content: c.input }],
  });
  meter.add(MODELS.deep, res.usage);
  const out = res.parsed_output!;
  let valid = 0;
  for (const cit of out.citations) {
    const [article] = await findByNum("benchmark", cit.num, cit.code.replace(/^code (de la |de l'|du |des |général des )?/i, ""));
    if (article && checkCitation(article, cit.quote, c.date_acte).length === 0) valid += 1;
  }
  return { verdict: out.verdict, citations: out.citations.length, valid_citations: valid, cost_usd: meter.usd, latency_ms: Date.now() - t0 };
}

async function lexguard(c: Case): Promise<Outcome> {
  const id = await createAnalysis({ title: c.title, input: c.input, collectivite: null, date_acte: c.date_acte });
  await runAnalysis(id);
  const client = await db();
  const a = (await client.query<{ cost_usd: string; latency_ms: number }>("select cost_usd, latency_ms from analyses where id = $1", [id])).rows[0];
  const findings = (await client.query<{ verdict: Verdict; verified: boolean; citations: unknown[] }>("select verdict, verified, citations from findings where analysis_id = $1", [id])).rows;
  const kept = findings.filter((f) => f.verified && f.verdict !== "conforme");
  // Verdict de l'acte : l'alerte retenue la plus fréquente, sinon conforme.
  const verdict = (kept.map((f) => f.verdict).sort((x, y) => kept.filter((f) => f.verdict === y).length - kept.filter((f) => f.verdict === x).length)[0] ?? "conforme") as Verdict;
  const citations = kept.reduce((n, f) => n + f.citations.length, 0);
  return { verdict, citations, valid_citations: citations, cost_usd: Number(a.cost_usd), latency_ms: a.latency_ms };
}

const correct = (c: Case, o: Outcome) => o.verdict === c.expected || (c.expected !== "conforme" && o.verdict !== "conforme" && ["conflit", "incompetence"].includes(c.expected) && ["conflit", "incompetence"].includes(o.verdict));

async function main() {
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    console.error("ANTHROPIC_API_KEY manquante : le benchmark appelle Claude.");
    process.exit(1);
  }
  const cases = JSON.parse(readFileSync("bench/cases.json", "utf8")) as Case[];
  const only = process.argv[2];
  const rows: Array<{ c: Case; before: Outcome; after: Outcome }> = [];
  for (const c of cases.filter((x) => !only || x.id === only)) {
    console.log(`→ ${c.id}`);
    const [before, after] = await Promise.all([baseline(c), lexguard(c)]);
    rows.push({ c, before, after });
    console.log(`   avant : ${before.verdict} (${before.valid_citations}/${before.citations} citations vérifiables) · après : ${after.verdict} (${after.valid_citations}/${after.citations})`);
  }
  const agg = (pick: (r: (typeof rows)[number]) => Outcome) => {
    const outs = rows.map((r) => ({ c: r.c, o: pick(r) }));
    const cit = outs.reduce((n, x) => n + x.o.citations, 0);
    return {
      accuracy: outs.filter((x) => correct(x.c, x.o)).length / outs.length,
      citation_validity: cit ? outs.reduce((n, x) => n + x.o.valid_citations, 0) / cit : 1,
      cost_usd: outs.reduce((n, x) => n + x.o.cost_usd, 0) / outs.length,
      latency_s: outs.reduce((n, x) => n + x.o.latency_ms, 0) / outs.length / 1000,
    };
  };
  const before = agg((r) => r.before);
  const after = agg((r) => r.after);
  const pct = (x: number) => `${Math.round(x * 100)} %`;
  const md = `# Benchmark Ciceron — ${new Date().toISOString().slice(0, 16).replace("T", " ")}

${rows.length} actes réels ou inspirés de contentieux connus (bench/cases.json), verdict attendu fixé à l'avance.

| | Avant : un appel Claude sans données | Après : équipe d'agents Ciceron |
|---|---|---|
| Bon verdict | ${pct(before.accuracy)} | ${pct(after.accuracy)} |
| Citations vérifiables (article existant, en vigueur, extrait exact) | ${pct(before.citation_validity)} | ${pct(after.citation_validity)} |
| Coût moyen par acte | ${before.cost_usd.toFixed(3)} $ | ${after.cost_usd.toFixed(3)} $ |
| Latence moyenne | ${before.latency_s.toFixed(1)} s | ${after.latency_s.toFixed(1)} s |

Référence humaine : un contrôle de légalité approfondi d'un arrêté prend couramment de 30 minutes à plusieurs heures à un juriste (estimation, à confirmer avec des préfectures).

| Cas | Attendu | Avant | Après |
|---|---|---|---|
${rows.map((r) => `| ${r.c.title} | ${r.c.expected} | ${r.before.verdict}${correct(r.c, r.before) ? " ✓" : " ✗"} (${r.before.valid_citations}/${r.before.citations} cit.) | ${r.after.verdict}${correct(r.c, r.after) ? " ✓" : " ✗"} (${r.after.valid_citations}/${r.after.citations} cit.) |`).join("\n")}
`;
  writeFileSync("bench/results.md", md);
  writeFileSync("bench/results.json", JSON.stringify({ before, after, rows }, null, 2));
  console.log(`\n${md}`);
  process.exit(0);
}
main();
