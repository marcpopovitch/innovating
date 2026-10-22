import { connection } from "next/server";
import { z } from "zod";
import { createAnalysis, runAnalysis } from "@/lib/agents/orchestrator";
import { db } from "@/lib/db";

const Body = z.object({
  title: z.string().min(1).max(300),
  input: z.string().min(20).max(60_000),
  collectivite: z.string().max(200).optional().nullable(),
  date_acte: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable().or(z.literal("")),
});

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    return Response.json({ error: "ANTHROPIC_API_KEY manquante côté serveur." }, { status: 503 });
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
    "select id, kind, title, collectivite, status, summary, cost_usd::float, latency_ms, created_at from analyses order by created_at desc limit 20",
  );
  return Response.json({ analyses: rows });
}
