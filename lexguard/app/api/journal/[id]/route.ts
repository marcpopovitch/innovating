import { connection } from "next/server";
import { db } from "@/lib/db";
import { legifranceJorfUrl } from "@/lib/dila";

// Un texte du JO : texte intégral et articles de code qu'il crée, modifie ou abroge.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  const client = await db();
  const { rows } = await client.query<{ id: string; nature: string | null; title: string; nor: string | null; date_publi: string | null; text: string | null; modifies: Array<{ id: string; type?: string; title: string }> }>(
    "select id, nature, title, nor, date_publi::text, text, modifies from jo_texts where id = $1",
    [id],
  );
  const t = rows[0];
  if (!t) return Response.json({ error: "Texte introuvable" }, { status: 404 });
  // Les articles visés présents dans notre corpus s'ouvrent dans le panneau « source ».
  const known = new Set(
    (await client.query<{ id: string }>("select id from articles where id = any($1)", [t.modifies.map((m) => m.id).filter((x) => x.startsWith("LEGIARTI"))])).rows.map((r) => r.id),
  );
  return Response.json({
    ...t,
    url: legifranceJorfUrl(t.id),
    modifies: t.modifies.slice(0, 60).map((m) => ({ ...m, in_corpus: known.has(m.id) })),
  });
}
