// Orchestration d'une analyse : analyste → chercheurs en parallèle → juges →
// contradicteurs + contrôles en code → rédacteur. Chaque étape est journalisée.
import { randomUUID } from "node:crypto";
import { db } from "../db";
import { legifranceArticleUrl } from "../dila";
import type { AnalysisSummary, Citation, Disposition, Severity, Verdict } from "../types";
import { emit } from "./events";
import { CostMeter } from "./llm";
import { analyst, critic, judge, researcher, writer } from "./roles";
import { getArticles } from "./tools";
import { checkCitation } from "./verify";

export interface AnalysisInput {
  title: string;
  input: string;
  collectivite?: string | null;
  date_acte?: string | null;
  kind?: "acte" | "jo";
}

export async function createAnalysis(input: AnalysisInput): Promise<string> {
  const id = randomUUID();
  const client = await db();
  await client.query("insert into analyses (id, kind, title, input, collectivite, date_acte) values ($1, $2, $3, $4, $5, $6)", [
    id,
    input.kind ?? "acte",
    input.title,
    input.input,
    input.collectivite ?? null,
    input.date_acte || null,
  ]);
  return id;
}

interface StoredFinding {
  verdict: Verdict;
  severity: Severity;
  title: string;
  verified: boolean;
}

async function analyseDisposition(analysisId: string, meter: CostMeter, d: Disposition, ctx: { autorite: string; collectivite: string | null; date: string | null }, consultedAll: Set<string>): Promise<StoredFinding> {
  const tag = `${d.id} · ${d.objet}`;
  await emit(analysisId, "chercheur", "etape", `Recherche des normes applicables — ${tag}`);
  const dossier = await researcher(meter, d, ctx, (msg) => void emit(analysisId, "chercheur", "outil", `${d.id} → ${msg}`));
  dossier.consulted.forEach((id) => consultedAll.add(id));
  const articles = await getArticles("juge", [...dossier.candidates.keys()]);
  await emit(analysisId, "chercheur", "resultat", `${d.id} : ${articles.length} articles retenus sur ${dossier.consulted.size} consultés`, { articles: articles.map((a) => `${a.code_title} ${a.num}`) });

  await emit(analysisId, "juge", "etape", `Qualification juridique — ${tag}`);
  const verdict = await judge(meter, d, articles, dossier.candidates, dossier.notes, ctx.date);

  // Contrôles en code : chaque citation doit exister, être en vigueur et contenir l'extrait.
  const byId = new Map(articles.map((a) => [a.id, a]));
  const extra = await getArticles("contradicteur", verdict.citations.map((c) => c.article_id).filter((id) => !byId.has(id)));
  extra.forEach((a) => byId.set(a.id, a));
  const problems = verdict.citations.flatMap((c) => checkCitation(byId.get(c.article_id) as never, c.quote, ctx.date));

  let verified = verdict.verdict === "conforme";
  let severity = verdict.severity;
  let rejection: string | null = null;
  if (verdict.verdict !== "conforme") {
    if (!verdict.citations.length) problems.push("aucune citation à l'appui");
    await emit(analysisId, "contradicteur", "etape", `Contre-expertise — ${verdict.title}`);
    const review = await critic(meter, d, verdict, [...byId.values()], problems);
    verified = review.keep && problems.length === 0;
    severity = review.severity;
    rejection = verified ? null : [...problems, review.keep ? "" : review.reason].filter(Boolean).join(" ; ");
    await emit(analysisId, "contradicteur", verified ? "resultat" : "rejet", verified ? `Alerte confirmée : ${verdict.title}` : `Alerte écartée : ${rejection}`);
  } else {
    await emit(analysisId, "juge", "resultat", `${d.id} conforme`);
  }

  const citations: Citation[] = verdict.citations.map((c) => {
    const a = byId.get(c.article_id);
    return { article_id: c.article_id, num: a?.num ?? "?", code: a?.code_title ?? "?", quote: c.quote, url: legifranceArticleUrl(c.article_id) };
  });
  const client = await db();
  await client.query(
    `insert into findings (id, analysis_id, disposition, verdict, severity, title, explanation, citations, suggestion, verified, rejection_reason)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [randomUUID(), analysisId, JSON.stringify(d), verdict.verdict, severity, verdict.title, verdict.explanation, JSON.stringify(citations), verdict.suggestion || null, verified, rejection],
  );
  return { verdict: verdict.verdict, severity, title: verdict.title, verified };
}

export async function runAnalysis(analysisId: string): Promise<void> {
  const client = await db();
  const t0 = Date.now();
  const meter = new CostMeter();
  const { rows } = await client.query<{ title: string; input: string; collectivite: string | null; date_acte: string | null }>(
    "select title, input, collectivite, date_acte::text from analyses where id = $1",
    [analysisId],
  );
  const a = rows[0];
  try {
    await emit(analysisId, "analyste", "etape", "Découpage de l'acte en dispositions normatives");
    const { autorite, dispositions } = await analyst(meter, a.input);
    await emit(analysisId, "analyste", "resultat", `${dispositions.length} dispositions identifiées (autorité : ${autorite})`, { dispositions });

    const consulted = new Set<string>();
    const ctx = { autorite, collectivite: a.collectivite, date: a.date_acte };
    await emit(analysisId, "orchestrateur", "etape", `${dispositions.length} chercheurs lancés en parallèle`);
    const settled = await Promise.allSettled(dispositions.map((d) => analyseDisposition(analysisId, meter, d, ctx, consulted)));
    const findings = settled.flatMap((s) => (s.status === "fulfilled" ? [s.value] : []));
    for (const s of settled) if (s.status === "rejected") await emit(analysisId, "orchestrateur", "erreur", String(s.reason instanceof Error ? s.reason.message : s.reason));

    await emit(analysisId, "redacteur", "etape", "Rédaction de la synthèse");
    const { headline } = await writer(meter, a.title, findings);
    const counts = { conflit: 0, doublon: 0, vide: 0, incompetence: 0, conforme: 0 } as Record<Verdict, number>;
    for (const f of findings) if (f.verified) counts[f.verdict] += 1;
    const summary: AnalysisSummary = { headline, counts, rejected: findings.filter((f) => !f.verified).length, articles_consulted: consulted.size };

    await client.query("update analyses set status = 'termine', summary = $2, cost_usd = $3, latency_ms = $4, finished_at = now() where id = $1", [
      analysisId,
      JSON.stringify(summary),
      meter.usd.toFixed(4),
      Date.now() - t0,
    ]);
    // Mémoire : l'acte analysé rejoint le corpus local de la collectivité (détection de doublons futurs).
    if (a.collectivite) {
      await client.query("insert into local_acts (collectivite, title, date_acte, text, source) values ($1, $2, $3, $4, 'analyse Ciceron')", [a.collectivite, a.title, a.date_acte, a.input]);
    }
    await emit(analysisId, "orchestrateur", "fin", headline, { cost_usd: meter.usd, latency_ms: Date.now() - t0, calls: meter.calls });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await client.query("update analyses set status = 'erreur', latency_ms = $2, finished_at = now() where id = $1", [analysisId, Date.now() - t0]);
    await emit(analysisId, "orchestrateur", "erreur", message);
    await emit(analysisId, "orchestrateur", "fin", "Analyse interrompue");
  }
}
