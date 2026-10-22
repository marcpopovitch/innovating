import { connection } from "next/server";
import { legifranceJorfUrl } from "@/lib/dila";
import { db } from "@/lib/db";
import type { VeilleItem } from "@/lib/types";

// Textes du JO les plus récents + actes locaux qui touchent au même sujet ou aux mêmes articles.
export async function GET() {
  await connection(); // toujours calculé à la requête
  const client = await db();
  const { rows } = await client.query<{ id: string; nature: string | null; title: string; date_publi: string | null; modifies: Array<{ id: string; title: string }> }>(
    // D'abord les textes qui touchent une collectivité suivie, puis ceux qui citent un code
    // suivi par LexGuard, puis le reste du JO récent.
    `select j.id, j.nature, j.title, j.date_publi::text, j.modifies from jo_texts j
      where j.nature in ('LOI', 'ORDONNANCE', 'DECRET', 'ARRETE') and j.date_publi >= (select max(date_publi) - 3 from jo_texts)
      order by exists (select 1 from veille_impacts v where v.jo_id = j.id) desc,
               exists (select 1 from jsonb_array_elements(j.modifies) m
                        where m->>'title' ~* '(collectivités territoriales|code rural|code de la route|santé publique|environnement|urbanisme|sécurité intérieure|code pénal|relations entre le public)') desc,
               j.date_publi desc, j.id desc
      limit 40`,
  );
  const impacts = await client.query<{ jo_id: string; collectivite: string; act_title: string; reason: string }>(
    "select jo_id, collectivite, act_title, reason from veille_impacts where jo_id = any($1)",
    [rows.map((r) => r.id)],
  ).catch(() => ({ rows: [] as Array<{ jo_id: string; collectivite: string; act_title: string; reason: string }> }));
  const items: VeilleItem[] = rows.map((r) => ({
    id: r.id,
    nature: r.nature,
    title: r.title,
    date_publi: r.date_publi,
    url: legifranceJorfUrl(r.id),
    modifies: r.modifies.map((m) => m.title).filter(Boolean).slice(0, 8),
    impacts: impacts.rows.filter((i) => i.jo_id === r.id).map(({ collectivite, act_title, reason }) => ({ collectivite, act_title, reason })),
  }));
  return Response.json({ items });
}
