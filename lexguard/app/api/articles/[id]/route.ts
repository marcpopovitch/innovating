import { connection } from "next/server";
import { db } from "@/lib/db";
import { sourceUrl } from "@/lib/agents/tools";

// Fiche d'un article cité : texte, toutes ses versions datées (pour voir ce qui a changé)
// et ses liens dans le graphe des normes.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  const client = await db();
  const cols = "id, code_id, niveau, url, code_title, num, section, text, etat, date_debut::text, date_fin::text";
  const { rows } = await client.query<{ id: string; code_id: string; num: string | null; url: string | null } & Record<string, unknown>>(`select ${cols} from articles where id = $1`, [id]);
  const article = rows[0];
  if (!article) return Response.json({ error: "Article introuvable" }, { status: 404 });
  // Les versions successives d'un article partagent son code et son numéro (cid désigne le code entier).
  const versions = article.num
    ? (await client.query(`select ${cols} from articles where code_id = $1 and num = $2 order by date_debut nulls first, id limit 30`, [article.code_id, article.num])).rows
    : [article];
  const links = (
    await client.query(
      `(select l.dst as id, l.type, coalesce(l.sens, 'source') as sens, coalesce(a.num, l.dst_title) as num, a.code_title
          from links l left join articles a on a.id = l.dst and a.etat = 'VIGUEUR' where l.src = any($1) limit 12)
       union all
       (select l.src as id, l.type, 'cité par' as sens, a.num, a.code_title
          from links l join articles a on a.id = l.src and a.etat = 'VIGUEUR' where l.dst = any($1) limit 12)`,
      [versions.map((v) => v.id)],
    )
  ).rows;
  return Response.json({ article: { ...article, source_url: sourceUrl(article) }, versions, links });
}
