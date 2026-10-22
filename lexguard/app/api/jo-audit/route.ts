import { z } from "zod";
import { callModalJoAudit, ModalNotConfiguredError } from "@/lib/agents/modal-client";

// Audit de conformité du Journal Officiel par date/période, exécuté par le service Modal.
// Synchrone : l'audit enchaîne plusieurs analyses (peut durer quelques minutes).

const DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const Body = z
  .object({
    date: DATE.optional(),
    date_from: DATE.optional(),
    date_to: DATE.optional(),
    max_texts: z.number().int().min(1).max(60).optional(),
  })
  .refine((b) => b.date || (b.date_from && b.date_to), {
    message: "Fournir 'date' ou le couple 'date_from'+'date_to' (format YYYY-MM-DD).",
  });

export async function POST(request: Request) {
  if (!process.env.MODAL_AGENTS_URL) {
    return Response.json({ error: "MODAL_AGENTS_URL manquante côté serveur (déployez agents/modal_app.py)." }, { status: 503 });
  }
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Requête invalide", details: parsed.error.issues }, { status: 400 });

  try {
    return Response.json(await callModalJoAudit(parsed.data));
  } catch (e) {
    if (e instanceof ModalNotConfiguredError) return Response.json({ error: e.message }, { status: 503 });
    return Response.json({ error: `Audit JO impossible : ${e instanceof Error ? e.message : "erreur réseau"}` }, { status: 502 });
  }
}
