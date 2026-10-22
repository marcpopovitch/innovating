// Les sous-agents : un par pod, même boîte à outils, mission différente.
// Puis un agent de synthèse qui ne lit que les preuves collectées.
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import type { Evidence, Ledger, Pod, PodReport } from "./evidence.js";
import type { Identity } from "./identity.js";
import { makeTools, type PodContext } from "./tools.js";

const POD_MODEL = process.env.SCOUT_POD_MODEL ?? "claude-sonnet-5-5";
const SYNTHESIS_MODEL = process.env.SCOUT_SYNTHESIS_MODEL ?? "claude-opus-5-5";
// Si le modèle décline pour raison de politique, l'API rejoue la requête sur son repli par défaut.
const FALLBACK = { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const };

export const POD_BRIEFS: Record<Pod, { title: string; mission: string }> = {
  snapshot: {
    title: "Snapshot",
    mission:
      "Établis la carte d'identité : nom légal et entité qui porte l'activité (holding vs filiale), pays, date de création, site, dernière levée (montant, date, série, lead), total levé, investisseurs, effectif, funding par employé. Recoupe presse et registres ; les augmentations de capital BODACC trahissent souvent une levée.",
  },
  traction: {
    title: "Traction",
    mission:
      "Mesure la dynamique : rythme de recrutement (offres ouvertes, équipes), activité GitHub si pertinent, ancienneté et évolution du site (Wayback), CA publié si disponible, clients et cas clients annoncés, croissance d'effectif citée par la presse. Préfère les séries dans le temps aux photos.",
  },
  team: {
    title: "Team",
    mission:
      "Décris les fondateurs et dirigeants : rôles, parcours (entreprises et écoles précédentes), exits, publications ou brevets, complémentarité de l'équipe. Pars des dirigeants du registre et de la page équipe/about du site. N'utilise jamais LinkedIn directement ; la presse et le site suffisent.",
  },
  market: {
    title: "Marché",
    mission:
      "Dimensionne le marché (avec méthode et source), sa dynamique, et liste 3 à 6 concurrents directs et indirects avec leur financement connu. Le sizing est un fait dérivé : cite ses hypothèses.",
  },
  product: {
    title: "Produit",
    mission:
      "Explique ce que fait le produit, pour qui, comment il est vendu et à quel prix (lis la page pricing, et son ancienne version via Wayback si utile), ce qui le différencie, et sa maturité (lancement, versions, docs, statut, sécurité/certifications).",
  },
  icp: {
    title: "ICP",
    mission:
      "Identifie le client cible (taille, secteur, persona acheteur), les cas d'usage, et les signaux de clients existants : logos, études de cas, témoignages, postes commerciaux ouverts qui révèlent le go-to-market.",
  },
};

const SYSTEM = `Tu es un analyste VC early-stage européen, rigoureux et sourcé. Tu travailles sur UN axe d'analyse d'une entreprise, en parallèle d'autres analystes.

Règles :
- Chaque chiffre ou fait de ton rapport cite des ids de preuve (ev_…) obtenus via les outils. Pas de preuve, pas d'affirmation.
- Quand tu trouves un fait par la recherche web ou read_page, enregistre-le avec record_evidence (URL, source, date) avant de le citer.
- Sépare observation, calcul (confidence "derived" + derived_from) et déduction (confidence "inferred"). Ne présente jamais une estimation comme un fait.
- Si deux sources se contredisent, garde les deux et signale l'écart dans unknowns.
- Ce que tu n'arrives pas à établir va dans unknowns : c'est une information utile pour le comité.
- Sois économe : 5 recherches web maximum, privilégie les sources officielles et primaires.
- Termine en appelant submit_report, en français, puis arrête-toi.`;

function dossier(identity: Identity, ledger: Ledger): string {
  const known = identity.evidenceIds.map((id) => ledger.get(id)!).map((e) => `${e.id} | ${e.claim}`).join("\n");
  return `Entreprise : ${identity.name} — ${identity.url}
Identifiants légaux trouvés sur le site : ${JSON.stringify(identity.legalIds)}

Preuves déjà collectées (citables) :
${known || "aucune"}

Page d'accueil (Markdown) :
${identity.homepage.slice(0, 12_000)}`;
}

export interface PodRun {
  pod: Pod;
  report: PodReport;
  submitted: boolean;
  steps: string[];
}

export async function runPod(client: Anthropic, pod: Pod, identity: Identity, ledger: Ledger, onLog: (pod: Pod, msg: string) => void): Promise<PodRun> {
  const steps: string[] = [];
  const ctx: PodContext = {
    ledger,
    seenUrls: new Set([identity.url]),
    recorded: [],
    log: (msg) => {
      steps.push(msg);
      onLog(pod, msg);
    },
  };
  const runner = client.beta.messages.toolRunner({
    model: POD_MODEL,
    max_tokens: 16000,
    max_iterations: 25,
    output_config: { effort: "medium" },
    ...FALLBACK,
    system: SYSTEM,
    tools: [...makeTools(ctx), { type: "web_search_20260209", name: "web_search", max_uses: 5 }],
    messages: [{ role: "user", content: `${dossier(identity, ledger)}\n\nTon axe : ${POD_BRIEFS[pod].title}.\n${POD_BRIEFS[pod].mission}` }],
  });

  for await (const message of runner) {
    for (const block of message.content) {
      if (block.type === "server_tool_use" && block.name === "web_search") ctx.log(`web_search "${(block.input as { query?: string }).query ?? ""}"`);
      if (block.type === "web_search_tool_result" && Array.isArray(block.content)) {
        for (const result of block.content) ctx.seenUrls.add(result.url);
      }
    }
    // Un tour d'outil serveur trop long s'interrompt : on le relance tel quel.
    if (message.stop_reason === "pause_turn") runner.pushMessages({ role: "assistant", content: message.content });
    if (ctx.report) break;
  }

  // Garde-fou anti-hallucination : une URL citée que l'agent n'a jamais vue est signalée.
  for (const id of ctx.recorded) {
    const evidence = ledger.get(id);
    if (evidence?.url && !ctx.seenUrls.has(evidence.url)) ledger.flag(id, "URL non consultée par l'agent : à vérifier");
  }

  return {
    pod,
    steps,
    submitted: !!ctx.report,
    report: ctx.report ?? { summary: "Le sous-agent n'a pas rendu de rapport dans le budget imparti.", metrics: [], unknowns: ["Pod incomplet"] },
  };
}

// ---- Synthèse : thèse, bull case, bear case automatique, questions aux fondateurs ----

const Cited = z.object({ point: z.string(), evidence_ids: z.array(z.string()) });
export const Synthesis = z.object({
  one_liner: z.string().describe("Ce que fait la boîte, en une phrase"),
  verdict: z.string().describe("Lecture d'analyste en 2-3 phrases : pourquoi c'est intéressant ou non"),
  bull_case: z.array(Cited),
  bear_case: z.array(Cited).describe("Les meilleurs arguments contre l'investissement"),
  red_flags: z.array(Cited).describe("Incohérences entre sources, signaux faibles inquiétants"),
  questions_for_founders: z.array(z.string()),
});
export type Synthesis = z.infer<typeof Synthesis>;

export async function synthesize(client: Anthropic, identity: Identity, pods: PodRun[], evidence: Evidence[]): Promise<Synthesis> {
  const brief = pods.map((p) => `## ${POD_BRIEFS[p.pod].title}\n${p.report.summary}\n${p.report.metrics.map((m) => `- ${m.label} : ${m.value} [${m.evidence_ids.join(", ")}]`).join("\n")}\nInconnues : ${p.report.unknowns.join(" ; ") || "aucune"}`).join("\n\n");
  const facts = evidence.map((e) => `${e.id} | ${e.claim} | ${e.source}${e.as_of ? ` | ${e.as_of}` : ""} | ${e.confidence}${e.limitations.length ? ` | limites : ${e.limitations.join(" ; ")}` : ""}`).join("\n");

  const response = await client.beta.messages.parse({
    model: SYNTHESIS_MODEL,
    max_tokens: 16000,
    output_config: { effort: "high", format: betaZodOutputFormat(Synthesis) },
    ...FALLBACK,
    system:
      "Tu es partner dans un fonds early-stage européen. Tu prépares la note de comité à partir des seuls rapports et preuves fournis — aucune connaissance extérieure. Chaque point cite des ids de preuve existants. Le bear case doit être honnête et précis, pas une formalité. Cherche activement les contradictions entre sources. Réponds en français.",
    messages: [{ role: "user", content: `Entreprise : ${identity.name} (${identity.url})\n\n# Rapports des analystes\n${brief}\n\n# Registre des preuves\n${facts}` }],
  });
  if (response.stop_reason === "refusal" || !response.parsed_output) throw new Error(`Synthèse impossible (stop_reason : ${response.stop_reason})`);
  return response.parsed_output;
}
