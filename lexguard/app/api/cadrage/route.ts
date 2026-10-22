import { z } from "zod";
import { cadrer } from "@/lib/agents/cadrage";

const Body = z.object({ prompt: z.string().min(3).max(60_000) });

// Questions de cadrage avant de lancer les agents (marche aussi sans clé API).
export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Requête invalide" }, { status: 400 });
  return Response.json(await cadrer(parsed.data.prompt));
}
