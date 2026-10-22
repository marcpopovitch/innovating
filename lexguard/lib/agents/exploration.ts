// Mode « explorer une idée » : pas de texte à contrôler, on cartographie ce qui
// existe déjà. Planificateur → chercheurs par angle (parallèles) → cartographe,
// puis les mêmes contrôles en code des citations que pour un contrôle.
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "../db";
import type { Citation, Disposition } from "../types";
import { emit } from "./events";
import { type CostMeter, MODELS, structured } from "./llm";
import { articleBlock, researcher } from "./roles";
import { getArticles, sourceUrl } from "./tools";
import { checkCitation } from "./verify";

const Plan = z.object({
  angles: z
    .array(z.object({ angle: z.string().describe("Question de recherche précise"), pourquoi: z.string() }))
    .describe("3 à 4 angles complémentaires : compétence, règles de fond, textes récents, pratiques des collectivités / droit UE"),
});

const Carte = z.object({
  headline: z.string().describe("Réponse courte à l'idée de l'utilisateur : ce qui existe, ce qui manque"),
  items: z.array(
    z.object({
      kind: z.enum(["existant", "vide"]).describe("existant = texte déjà en vigueur sur le sujet ; vide = point que rien ne règle"),
      title: z.string(),
      explanation: z.string().describe("Ce que dit ce texte et pourquoi il compte pour l'idée, 2 à 4 phrases"),
      citations: z.array(z.object({ article_id: z.string(), quote: z.string().describe("Extrait COPIÉ MOT POUR MOT") })),
      suggestion: z.string().describe("Conséquence pratique pour la collectivité ; vide si aucune"),
    }),
  ),
});

export async function runExploration(analysisId: string, meter: CostMeter, idea: string, cadrage: string, consulted: Set<string>) {
  await emit(analysisId, "analyste", "etape", "Découpage de l'idée en angles de recherche");
  const plan = await structured(
    meter,
    MODELS.router,
    "low",
    "Tu prépares une recherche juridique pour une collectivité qui a une idée de mesure. Découpe-la en 3 ou 4 angles de recherche complémentaires et précis.",
    `${idea}${cadrage}`,
    Plan,
    4000,
  ).catch(() => null);
  const angles = (plan?.angles ?? [{ angle: idea, pourquoi: "demande initiale" }]).slice(0, 4);
  await emit(analysisId, "analyste", "resultat", `${angles.length} angles de recherche`, { angles });

  await emit(analysisId, "orchestrateur", "etape", `${angles.length} chercheurs lancés en parallèle`);
  const dossiers = await Promise.all(
    angles.map(async (a, i) => {
      const d: Disposition = { id: `a${i + 1}`, text: a.angle, objet: a.angle, mesure: a.pourquoi, autorite: "collectivité", references: [] };
      await emit(analysisId, "chercheur", "etape", `Angle ${i + 1} : ${a.angle}`);
      const r = await researcher(meter, d, { autorite: "collectivité", collectivite: null }, (msg) => void emit(analysisId, "chercheur", "outil", `${d.id} → ${msg}`), { mode: "exploration", cadrage });
      r.consulted.forEach((id) => consulted.add(id));
      return r;
    }),
  );
  const why = new Map<string, string>();
  for (const r of dossiers) for (const [id, w] of r.candidates) why.set(id, w);
  const articles = await getArticles("cartographe", [...why.keys()].slice(0, 24));
  await emit(analysisId, "chercheur", "resultat", `${articles.length} textes retenus sur ${consulted.size} consultés`);

  await emit(analysisId, "juge", "etape", "Cartographie de ce qui existe déjà");
  const carte = await structured(
    meter,
    MODELS.deep,
    "high",
    "Tu es juriste en droit public. À partir des seuls textes fournis, dresse l'état du droit sur l'idée de la collectivité : ce qui existe déjà (avec citations mot pour mot) et les vides éventuels. Ne t'appuie jamais sur ta mémoire. Seule la version publiée sur Légifrance fait foi.",
    `Idée : ${idea}${cadrage}\n\nNotes des chercheurs :\n${dossiers.map((r) => r.notes).filter(Boolean).join("\n")}\n\nTextes :\n${articleBlock(articles, why)}`,
    Carte,
  );

  // Contrôles en code : on ne garde que des citations exactes d'articles en vigueur.
  const byId = new Map(articles.map((a) => [a.id, a]));
  const client = await db();
  let kept = 0;
  for (const item of carte.items) {
    const valid = item.citations.filter((c) => checkCitation(byId.get(c.article_id) as never, c.quote, null).length === 0);
    const verified = item.kind === "vide" || valid.length > 0;
    if (verified) kept += 1;
    const citations: Citation[] = valid.map((c) => {
      const a = byId.get(c.article_id)!;
      return { article_id: a.id, num: a.num ?? "?", code: a.code_title, quote: c.quote, url: sourceUrl(a) };
    });
    await client.query(
      `insert into findings (id, analysis_id, disposition, verdict, severity, title, explanation, citations, suggestion, verified, rejection_reason)
       values ($1, $2, $3, $4, 'info', $5, $6, $7, $8, $9, $10)`,
      [randomUUID(), analysisId, JSON.stringify({ id: "idee", text: idea.slice(0, 500), objet: item.title, mesure: "", autorite: "", references: [] }), item.kind, item.title, item.explanation, JSON.stringify(citations), item.suggestion || null, verified, verified ? null : "aucune citation vérifiable dans le corpus"],
    );
    await emit(analysisId, "contradicteur", verified ? "resultat" : "rejet", verified ? `${item.kind === "vide" ? "Vide" : "Texte existant"} : ${item.title}` : `Écarté faute de citation vérifiable : ${item.title}`);
  }
  return { headline: carte.headline, kept, rejected: carte.items.length - kept };
}
