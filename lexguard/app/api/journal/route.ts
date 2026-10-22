import { connection } from "next/server";
import { db } from "@/lib/db";
import { legifranceJorfUrl } from "@/lib/dila";
import { secteursOf } from "@/lib/secteurs";

// Explorateur du Journal officiel : mois disponibles, jours d'un mois, textes d'un jour.
// GET /api/journal?month=AAAA-MM&day=AAAA-MM-JJ
export async function GET(request: Request) {
  await connection();
  const params = new URL(request.url).searchParams;
  const client = await db();
  const months = (
    await client.query<{ month: string; n: number }>(
      "select to_char(date_publi, 'YYYY-MM') as month, count(*)::int as n from jo_texts where date_publi is not null group by 1 order by 1 desc",
    )
  ).rows;
  const month = /^\d{4}-\d{2}$/.test(params.get("month") ?? "") ? params.get("month")! : months[0]?.month;
  const days = month
    ? (
        await client.query<{ day: string; n: number }>(
          "select date_publi::text as day, count(*)::int as n from jo_texts where to_char(date_publi, 'YYYY-MM') = $1 group by 1 order by 1",
          [month],
        )
      ).rows
    : [];
  const day = /^\d{4}-\d{2}-\d{2}$/.test(params.get("day") ?? "") && days.some((d) => d.day === params.get("day")) ? params.get("day")! : days.at(-1)?.day;
  const rows = day
    ? (
        await client.query<{ id: string; nature: string | null; title: string; nor: string | null; modifies: Array<{ id: string; title: string }> }>(
          "select id, nature, title, nor, modifies from jo_texts where date_publi = $1 order by nature, title",
          [day],
        )
      ).rows
    : [];
  const items = rows.map((r) => {
    const codes = [...new Set(r.modifies.map((m) => m.title?.match(/^(Code [^-–]+?)(?:\s+-|\s*$)/)?.[1]?.trim()).filter(Boolean))] as string[];
    return {
      id: r.id,
      nature: r.nature,
      title: r.title,
      nor: r.nor,
      url: legifranceJorfUrl(r.id),
      codes: codes.slice(0, 4),
      modifies: r.modifies.length,
      secteurs: secteursOf(`${r.title} ${r.modifies.map((m) => m.title).join(" ")}`),
    };
  });
  return Response.json({ months, month, days, day, items });
}
