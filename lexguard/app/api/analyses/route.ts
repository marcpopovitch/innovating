import { connection } from "next/server";
import { z } from "zod";
import { hasLlmKey } from "@/lib/agents/llm";
import { createAnalysis, runAnalysis } from "@/lib/agents/orchestrator";
import { MODEL_CHOICES } from "@/lib/types";
import { db } from "@/lib/db";

const Body = z.object({
  title: z.string().min(1).max(300),
  input: z.string().min(3).max(60_000),
  collectivite: z.string().max(200).optional().nullable(),
  date_acte: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable().or(z.literal("")),
  mode: z.enum(["controle", "exploration"]).default("controle"),
  model: z.string().refine((m) => MODEL_CHOICES.some((c) => c.id === m), "modèle inconnu").default("gpt-6-luna"),
  cadrage: z.record(z.string(), z.string().max(500)).optional().nullable(),
});

export async function POST(request: Request) {
  if (!hasLlmKey()) {
    return Response.json({ error: "Aucune clé de modèle côté serveur (OPENROUTER_API_KEY ou ANTHROPIC_API_KEY)." }, { status: 503 });
  }
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Requête invalide", details: parsed.error.issues }, { status: 400 });
  const id = await createAnalysis({ ...parsed.data, date_acte: parsed.data.date_acte || null });
  // L'analyse tourne en tâche de fond (serveur Node long-vivant) ; l'interface suit le flux SSE.
  void runAnalysis(id);
  return Response.json({ id }, { status: 202 });
}

export async function GET() {
  await connection(); // toujours calculé à la requête
  const client = await db();
  const { rows } = await client.query(
    "select id, kind, mode, model, cadrage, title, collectivite, status, summary, cost_usd::float, latency_ms, created_at from analyses order by created_at desc limit 50",
  );
  return Response.json({ analyses: rows });
}
