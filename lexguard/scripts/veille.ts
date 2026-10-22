// Veille : ingère les derniers JO puis cherche les actes locaux touchés.
// Usage : npm run veille -- [jours]
import { runVeille } from "../lib/agents/impact";
import { ingestJo } from "./ingest-jo";

async function main() {
  await ingestJo(3);
  await runVeille(Number(process.argv[2] ?? 2));
  process.exit(0);
}
main();
