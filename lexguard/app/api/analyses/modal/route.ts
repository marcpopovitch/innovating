import { z } from "zod";
import { callModalCheck, ModalNotConfiguredError } from "@/lib/agents/modal-client";

// Analyse via le service d'agents Python déployé sur Modal (chemin parallèle au moteur TS de /api/analyses).
// Synchrone : /check renvoie le résultat complet, pas de SSE ni de persistance en base.

const Body = z.object({
  input: z.string().min(20).max(60_000),
});

export async function POST(request: Request) {
  if (!process.env.MODAL_AGENTS_URL) {
    return Response.json({ error: "MODAL_AGENTS_URL manquante côté serveur (déployez agents/modal_app.py)." }, { status: 503 });
  }
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Requête invalide", details: parsed.error.issues }, { status: 400 });

  try {
    const result = await callModalCheck(parsed.data.input);
    return Response.json(result);
  } catch (e) {
    if (e instanceof ModalNotConfiguredError) return Response.json({ error: e.message }, { status: 503 });
    return Response.json({ error: `Analyse Modal impossible : ${e instanceof Error ? e.message : "erreur réseau"}` }, { status: 502 });
  }
}
