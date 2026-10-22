import { db } from "@/lib/db";
import type { CorpusRow } from "@/lib/dila";
import { lireFichier } from "@/lib/fichiers";
import { upsert } from "@/scripts/ingest-hierarchy";

const MAX_TOTAL = 200 * 1024 * 1024;
const MAX_FICHIERS = 5000;

// Fichier(s) déposé(s) dans l'outil (un fichier, ou tout le contenu d'un dossier) :
// textes des actes à analyser, et/ou décisions du Conseil d'État à ajouter au corpus
// (ajout réservé au poste local, comme /api/admin).
export async function POST(request: Request) {
  const files = ((await request.formData().catch(() => null))?.getAll("file") ?? []).filter((f) => f instanceof File);
  if (!files.length) return Response.json({ error: "Aucun fichier reçu" }, { status: 400 });
  if (files.length > MAX_FICHIERS) return Response.json({ error: `Trop de fichiers (${MAX_FICHIERS} maximum)` }, { status: 413 });
  if (files.reduce((n, f) => n + f.size, 0) > MAX_TOTAL) return Response.json({ error: "Envoi trop lourd (200 Mo maximum)" }, { status: 413 });

  const rows: CorpusRow[] = [];
  const actes: Array<{ name: string; text: string }> = [];
  let erreur = "";
  for (const file of files) {
    try {
      const lu = await lireFichier(file.name, Buffer.from(await file.arrayBuffer()));
      if (lu.kind === "acte") actes.push({ name: file.name, text: lu.text });
      else rows.push(...lu.rows);
    } catch (error) {
      // Dans un dossier, un fichier d'un autre format est simplement ignoré.
      erreur ||= error instanceof Error ? error.message : "Fichier illisible";
    }
  }
  if (!rows.length && !actes.length) return Response.json({ error: erreur || "Aucun fichier lisible" }, { status: 422 });

  for (const a of actes) a.text = a.text.slice(0, 60_000);
  if (!rows.length) return Response.json({ actes });

  const host = new URL(request.url).hostname;
  if (process.env.NODE_ENV === "production" || !["localhost", "127.0.0.1"].includes(host)) {
    return Response.json({ error: "L'ajout de décisions à la base se fait depuis le poste local." }, { status: 403 });
  }
  const client = await db();
  const ids = [...new Set(rows.map((r) => r.id))];
  const { rows: deja } = await client.query<{ n: number }>("select count(*)::int n from articles where id = any($1)", [ids]);
  await upsert(rows);
  return Response.json({ actes, total: ids.length, nouvelles: ids.length - deja[0].n });
}
