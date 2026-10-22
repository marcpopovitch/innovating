import { z } from "zod";
import { db } from "@/lib/db";

const Body = z.object({ finding_id: z.string().uuid(), decision: z.enum(["valide", "rejete"]), reason: z.string().max(1000).optional() });

// Les retours des juristes deviennent la « doctrine interne » relue par le juge aux analyses suivantes.
export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Requête invalide" }, { status: 400 });
  const client = await db();
  const { rows } = await client.query<{ disposition: { text: string }; verdict: string }>("select disposition, verdict from findings where id = $1", [parsed.data.finding_id]);
  if (!rows.length) return Response.json({ error: "Alerte introuvable" }, { status: 404 });
  await client.query("insert into feedback (finding_id, decision, reason, disposition_text, finding_verdict) values ($1, $2, $3, $4, $5)", [
    parsed.data.finding_id,
    parsed.data.decision,
    parsed.data.reason ?? null,
    rows[0].disposition.text,
    rows[0].verdict,
  ]);
  return Response.json({ ok: true });
}
