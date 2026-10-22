import { db } from "@/lib/db";

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const client = await db();
  const { rows } = await client.query(
    "select id, kind, title, input, collectivite, date_acte::text, status, summary, cost_usd::float, latency_ms, created_at from analyses where id = $1",
    [id],
  );
  if (!rows.length) return Response.json({ error: "Analyse introuvable" }, { status: 404 });
  const findings = await client.query(
    `select id, analysis_id, disposition, verdict, severity, title, explanation, citations, suggestion, verified, rejection_reason
       from findings where analysis_id = $1
      order by verified desc, case severity when 'critique' then 0 when 'majeure' then 1 when 'mineure' then 2 else 3 end, created_at`,
    [id],
  );
  return Response.json({ analysis: rows[0], findings: findings.rows });
}
