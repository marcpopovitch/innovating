import { appendFileSync } from "node:fs";
import { join } from "node:path";
import { ingestHierarchy } from "@/scripts/ingest-hierarchy";
import { ingestLegi } from "@/scripts/ingest-legi";
import { ingestJo } from "@/scripts/ingest-jo";

// Applique les incréments LEGI depuis le serveur déjà lancé (la base PGlite locale
// n'accepte qu'un processus). Réservé au poste de développement.
let running = false;

export async function POST(request: Request) {
  const host = new URL(request.url).hostname;
  if (process.env.NODE_ENV === "production" || !["localhost", "127.0.0.1"].includes(host)) return Response.json({ error: "Réservé au poste local" }, { status: 403 });
  if (running) return Response.json({ status: "déjà en cours" }, { status: 409 });
  running = true;
  const logFile = join(process.cwd(), ".data", "ingest-legi-incr.log");
  const log = (m: string) => appendFileSync(logFile, `${m}\n`);
  // ?job=hierarchie : Constitution, codes supplémentaires, CEDH/UE, Conseil d'État.
  const job = new URL(request.url).searchParams.get("job");
  // ?job=jo&since=AAAAMMJJ : historique du Journal officiel, fichiers supprimés après lecture.
  const since = new URL(request.url).searchParams.get("since") ?? undefined;
  void (job === "jo" ? ingestJo(3, log, { since, cleanup: true }) : job === "hierarchie" ? ingestHierarchy(log, false) : job === "hierarchie-suite" ? ingestHierarchy(log, false, true) : ingestLegi(undefined, "all", log, false))
    .catch((error) => log(`ERREUR ${error instanceof Error ? error.message : String(error)}`))
    .finally(() => {
      running = false;
      log("FIN");
    });
  return Response.json({ status: "lancé", log: logFile }, { status: 202 });
}
