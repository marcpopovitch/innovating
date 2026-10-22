import { connection } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  await connection(); // toujours calculé à la requête
  const client = await db();
  const one = async (sql: string) => Number(Object.values((await client.query(sql)).rows[0] ?? { n: 0 })[0] ?? 0);
  const [articles, enVigueur, links, joTexts, localActs, analyses, findings, feedback] = await Promise.all([
    one("select count(*) from articles"),
    one("select count(*) from articles where etat = 'VIGUEUR'"),
    one("select count(*) from links"),
    one("select count(*) from jo_texts"),
    one("select count(*) from local_acts"),
    one("select count(*) from analyses"),
    one("select count(*) from findings"),
    one("select count(*) from feedback"),
  ]);
  const codes = await client.query("select code_id, code_title, count(*)::int as articles from articles where etat = 'VIGUEUR' group by 1, 2 order by 3 desc");
  const lastJo = await client.query<{ d: string | null }>("select max(date_publi)::text as d from jo_texts");
  const recent = await client.query("select ts, actor, kind, detail, rows, ms from query_log order by id desc limit 25");
  return Response.json({
    articles,
    articles_en_vigueur: enVigueur,
    codes: codes.rows,
    links,
    jo_texts: joTexts,
    last_jo_date: lastJo.rows[0]?.d ?? null,
    local_acts: localActs,
    analyses,
    findings,
    feedback,
    recent_queries: recent.rows,
  });
}
