// npm run analyse -- <url|domaine> [--collect-only] [--pods=snapshot,team]
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { type Pod, PODS } from "./evidence.js";
import { analyse } from "./orchestrator.js";
import { renderHtml } from "./render.js";

if (existsSync(".env")) process.loadEnvFile(".env");

const args = process.argv.slice(2);
const input = args.find((a) => !a.startsWith("--"));
if (!input) {
  console.error("Usage : npm run analyse -- <url|domaine> [--collect-only] [--pods=snapshot,team,…]");
  process.exit(1);
}
const collectOnly = args.includes("--collect-only");
const podsArg = args.find((a) => a.startsWith("--pods="))?.slice(7).split(",");
const pods = podsArg?.filter((p): p is Pod => (PODS as readonly string[]).includes(p));

if (!collectOnly && !process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
  console.error("ANTHROPIC_API_KEY manquante (dans .env ou l'environnement). Lance avec --collect-only pour la collecte sans IA.");
  process.exit(1);
}

const t0 = Date.now();
const analysis = await analyse(input, {
  collectOnly,
  pods,
  log: (scope, msg) => console.log(`${String(Math.round((Date.now() - t0) / 1000)).padStart(4)}s  ${scope.padEnd(9)} ${msg}`),
});

const slug = analysis.identity.domain.replace(/[^a-z0-9]+/gi, "-");
await mkdir("out", { recursive: true });
await writeFile(`out/${slug}.json`, JSON.stringify(analysis, null, 2));
await writeFile(`out/${slug}.html`, renderHtml(analysis));
console.log(`\n${analysis.evidence.length} preuves, ${analysis.pods.length} pods, ${analysis.errors.length} erreur(s) → out/${slug}.html`);
for (const error of analysis.errors) console.error(`  ✗ ${error}`);
