// Orchestration d'une analyse : analyste → chercheurs en parallèle → juges →
// contradicteurs + contrôles en code → rédacteur. Chaque étape est journalisée.
import { randomUUID } from "node:crypto";
import { db } from "../db";
import { legifranceArticleUrl } from "../dila";
import { type AnalysisSummary, type Citation, type Disposition, type Mode, MODEL_CHOICES, type Severity, type Verdict } from "../types";
import { cadrageText, periodSince } from "./cadrage";
import { emit } from "./events";
import { runExploration } from "./exploration";
import { CostMeter, withModel } from "./llm";
import { analyst, critic, judge, LEVELS, levelResearcher, researcher, writer } from "./roles";
import { getArticles, sourceUrl } from "./tools";
import { checkCitation } from "./verify";

export interface AnalysisInput {
  title: string;
  input: string;
  collectivite?: string | null;
  date_acte?: string | null;
  kind?: "acte" | "jo";
  mode?: Mode;
  model?: string;
  cadrage?: Record<string, string> | null;
}

export async function createAnalysis(input: AnalysisInput): Promise<string> {
  const id = randomUUID();
  const client = await db();
  await client.query("insert into analyses (id, kind, title, input, collectivite, date_acte, mode, model, cadrage) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)", [
    id,
    input.kind ?? "acte",
    input.title,
    input.input,
    input.collectivite ?? null,
    input.date_acte || null,
    input.mode ?? "controle",
    input.model ?? "claude-haiku-5-5",
    input.cadrage ? JSON.stringify(input.cadrage) : null,
  ]);
  return id;
}

interface StoredFinding {
  verdict: Verdict;
  severity: Severity;
  title: string;
  verified: boolean;
}

type LevelDossier = Awaited<ReturnType<typeof levelResearcher>>;

async function analyseDisposition(
  analysisId: string,
  meter: CostMeter,
  d: Disposition,
  ctx: { autorite: string; collectivite: string | null; date: string | null; cadrage: string },
  consultedAll: Set<string>,
  levels: Promise<LevelDossier[]>, // dossiers des experts constitution / UE / jurisprudence (partagés)
): Promise<StoredFinding> {
  const tag = `${d.id} · ${d.objet}`;
  await emit(analysisId, "chercheur", "etape", `Recherche des normes applicables — ${tag}`);
  const dossier = await researcher(meter, d, ctx, (msg) => void emit(analysisId, "chercheur", "outil", `${d.id} → ${msg}`), { mode: "controle", cadrage: ctx.cadrage });
  dossier.consulted.forEach((id) => consultedAll.add(id));
  // On ajoute au dossier des codes ce que les experts de niveau ont retenu pour cette disposition.
  const why = new Map(dossier.candidates);
  let notes = dossier.notes;
  for (const lv of await levels) {
    for (const [id, w] of lv.candidates) {
      const targets = lv.assign.get(id) ?? [];
      if (!targets.length || targets.includes(d.id)) why.set(id, `${lv.level.label} — ${w}`);
    }
    if (lv.notes) notes += `\n${lv.level.label} : ${lv.notes}`;
  }
  const articles = await getArticles("juge", [...why.keys()].slice(0, 16));
  await emit(analysisId, "chercheur", "resultat", `${d.id} : ${articles.length} textes retenus (codes, Constitution, UE, jurisprudence)`, { articles: articles.map((a) => `${a.code_title} ${a.num}`) });

  await emit(analysisId, "juge", "etape", `Qualification juridique — ${tag}`);
  const verdict = await judge(meter, d, articles, why, notes, ctx.date, ctx.cadrage);

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
    return { article_id: c.article_id, num: a?.num ?? "?", code: a?.code_title ?? "?", quote: c.quote, url: a ? sourceUrl(a) : legifranceArticleUrl(c.article_id) };
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
  const { rows } = await client.query<{ model: string }>("select model from analyses where id = $1", [analysisId]);
  const model = rows[0]?.model && MODEL_CHOICES.some((c) => c.id === rows[0].model) ? rows[0].model : "claude-haiku-5-5";
  return withModel(model, () => run(analysisId));
}

async function run(analysisId: string): Promise<void> {
  const client = await db();
  const t0 = Date.now();
  const meter = new CostMeter();
  const { rows } = await client.query<{ title: string; input: string; collectivite: string | null; date_acte: string | null; mode: Mode; cadrage: Record<string, string> | null }>(
    "select title, input, collectivite, date_acte::text, mode, cadrage from analyses where id = $1",
    [analysisId],
  );
  const a = rows[0];
  const since = periodSince(a.cadrage);
  const cadrage = cadrageText(a.cadrage) + (since ? ` Pour la période, utilise le filtre since=${since} de search_corpus et search_jo.` : "");
  const finish = async (headline: string, summary: AnalysisSummary) => {
    await client.query("update analyses set status = 'termine', summary = $2, cost_usd = $3, latency_ms = $4, finished_at = now() where id = $1", [
      analysisId,
      JSON.stringify(summary),
      meter.usd.toFixed(4),
      Date.now() - t0,
    ]);
    await emit(analysisId, "orchestrateur", "fin", headline, { cost_usd: meter.usd, latency_ms: Date.now() - t0, calls: meter.calls });
  };
  try {
    const consulted = new Set<string>();
    if (a.mode === "exploration") {
      const out = await runExploration(analysisId, meter, a.input, cadrage, consulted);
      const counts = { conflit: 0, doublon: 0, vide: 0, incompetence: 0, conforme: 0, existant: 0 } as Record<Verdict, number>;
      const found = await client.query<{ verdict: Verdict; n: number }>("select verdict, count(*)::int n from findings where analysis_id = $1 and verified group by 1", [analysisId]);
      for (const r of found.rows) counts[r.verdict] = r.n;
      await finish(out.headline, { headline: out.headline, counts, rejected: out.rejected, articles_consulted: consulted.size });
      return;
    }

    await emit(analysisId, "analyste", "etape", "Découpage de l'acte en dispositions normatives");
    const { autorite, dispositions } = await analyst(meter, a.input);
    await emit(analysisId, "analyste", "resultat", `${dispositions.length} dispositions identifiées (autorité : ${autorite})`, { dispositions });

    const ctx = { autorite, collectivite: a.collectivite, date: a.date_acte, cadrage };
    await emit(analysisId, "orchestrateur", "etape", `${dispositions.length} chercheurs (codes) + ${LEVELS.length} experts (Constitution, UE, jurisprudence) lancés en parallèle`);
    const levels = Promise.all(
      LEVELS.map(async (level) => {
        await emit(analysisId, "chercheur", "etape", `Expert « ${level.label} »`);
        const r = await levelResearcher(meter, level, dispositions, ctx, (msg) => void emit(analysisId, "chercheur", "outil", `${level.id} → ${msg}`), cadrage).catch(async (error) => {
          await emit(analysisId, "orchestrateur", "erreur", `${level.label} : ${error instanceof Error ? error.message : String(error)}`);
          return null;
        });
        if (r) {
          r.consulted.forEach((id) => consulted.add(id));
          await emit(analysisId, "chercheur", "resultat", `${level.label} : ${r.candidates.size} textes retenus`);
        }
        return r;
      }),
    ).then((all) => all.filter((r): r is LevelDossier => r !== null));
    const settled = await Promise.allSettled(dispositions.map((d) => analyseDisposition(analysisId, meter, d, ctx, consulted, levels)));
    const findings = settled.flatMap((s) => (s.status === "fulfilled" ? [s.value] : []));
    for (const s of settled) if (s.status === "rejected") await emit(analysisId, "orchestrateur", "erreur", String(s.reason instanceof Error ? s.reason.message : s.reason));

    await emit(analysisId, "redacteur", "etape", "Rédaction de la synthèse");
    const { headline } = await writer(meter, a.title, findings);
    const counts = { conflit: 0, doublon: 0, vide: 0, incompetence: 0, conforme: 0, existant: 0 } as Record<Verdict, number>;
    for (const f of findings) if (f.verified) counts[f.verdict] += 1;
    // Mémoire : l'acte analysé rejoint le corpus local de la collectivité (détection de doublons futurs).
    if (a.collectivite) {
      await client.query("insert into local_acts (collectivite, title, date_acte, text, source) values ($1, $2, $3, $4, 'analyse Ciceron')", [a.collectivite, a.title, a.date_acte, a.input]);
    }
    await finish(headline, { headline, counts, rejected: findings.filter((f) => !f.verified).length, articles_consulted: consulted.size });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await client.query("update analyses set status = 'erreur', latency_ms = $2, finished_at = now() where id = $1", [analysisId, Date.now() - t0]);
    await emit(analysisId, "orchestrateur", "erreur", message);
    await emit(analysisId, "orchestrateur", "fin", "Analyse interrompue");
  }
}
