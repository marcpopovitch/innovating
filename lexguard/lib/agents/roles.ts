// Les cinq rôles. L'analyste découpe, les chercheurs explorent le corpus en
// plusieurs étapes, le juge tranche, le contradicteur attaque, le rédacteur synthétise.
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { tracedQuery } from "../db";
import type { Disposition, Severity, Verdict } from "../types";
import { anthropic, type CostMeter, FALLBACK, MODELS } from "./llm";
import { type FullArticle, makeResearchTools, type NiveauFiltre, type ResearchState } from "./tools";

const SOURCES_RULE =
  "Tu ne t'appuies que sur les textes fournis ou trouvés avec tes outils, jamais sur ta mémoire. Seule la version publiée sur Légifrance fait foi.";

async function parse<T extends z.ZodType>(meter: CostMeter, model: string, effort: "low" | "medium" | "high", system: string, user: string, schema: T): Promise<z.infer<T>> {
  const response = await anthropic().beta.messages.parse({
    model,
    max_tokens: 16000,
    output_config: { effort, format: betaZodOutputFormat(schema) },
    ...FALLBACK,
    system,
    messages: [{ role: "user", content: user }],
  });
  meter.add(model, response.usage);
  if (response.stop_reason === "refusal" || !response.parsed_output) throw new Error(`Réponse inexploitable (${response.stop_reason})`);
  return response.parsed_output as z.infer<T>;
}

// ---------- 1. Analyste ----------

const DispositionsSchema = z.object({
  autorite: z.string().describe("Autorité qui édicte l'acte"),
  dispositions: z.array(
    z.object({
      text: z.string().describe("Extrait exact de l'acte"),
      objet: z.string(),
      mesure: z.string().describe("Ce que la règle impose, interdit ou autorise"),
      autorite: z.string(),
      perimetre: z.string().describe("Lieu, public visé, durée ; vide si non précisé"),
      references: z.array(z.string()).describe("Textes visés ou cités par l'acte pour cette règle"),
    }),
  ),
});

export async function analyst(meter: CostMeter, acte: string): Promise<{ autorite: string; dispositions: Disposition[] }> {
  const out = await parse(
    meter,
    MODELS.fast,
    "low",
    "Tu es juriste en droit public. Tu découpes un acte administratif (arrêté, délibération, décret) en dispositions normatives : une règle par entrée. Ignore les visas, considérants et formules d'exécution, sauf s'ils fondent la compétence. 6 dispositions au maximum, en regroupant les règles de même objet.",
    acte,
    DispositionsSchema,
  );
  return { autorite: out.autorite, dispositions: out.dispositions.slice(0, 6).map((d, i) => ({ ...d, id: `d${i + 1}` })) };
}

// ---------- 2. Chercheur (agent multi-étapes avec outils) ----------

export interface ResearchOptions {
  mode?: "controle" | "exploration";
  cadrage?: string; // texte de cadrage (domaine, période, périmètre…)
}

const RESEARCH_METHOD = {
  controle: `Tu es chercheur juridique pour une préfecture qui exerce le contrôle de légalité. Pour UNE disposition d'un acte local, tu constitues le dossier de normes supérieures que le juge devra lire.
Méthode : (1) identifie la base de compétence de l'autorité (ex. pouvoirs de police du maire, CGCT L2212-1 et suivants) ; (2) cherche s'il existe une police spéciale ou une compétence d'une autre autorité (État, préfet, ministre) sur cet objet ; (3) cherche les règles de fond (seuils, interdictions, procédures) ; (4) vérifie les doublons avec les actes locaux existants ; (5) si l'acte vise un texte UE, lis-le.`,
  exploration: `Tu es chercheur juridique pour une collectivité qui envisage une nouvelle mesure. Pour UN angle de recherche, tu cartographies ce qui existe déjà : règles en vigueur, autorité compétente, textes récents du Journal officiel, actes déjà pris par des collectivités, droit de l'UE si le périmètre l'inclut.`,
};

export async function researcher(meter: CostMeter, d: Disposition, acte: { autorite: string; collectivite: string | null }, onTool: (msg: string) => void, opts: ResearchOptions = {}) {
  const state = { candidates: new Map<string, string>(), consulted: new Set<string>() };
  const tools = makeResearchTools(`chercheur ${d.id}`, state);
  const runner = anthropic().beta.messages.toolRunner({
    model: MODELS.fast,
    max_tokens: 16000,
    max_iterations: 14,
    output_config: { effort: "medium" },
    ...FALLBACK,
    system: `${RESEARCH_METHOD[opts.mode ?? "controle"]} Fais plusieurs recherches avec des formulations juridiques différentes, lis les articles prometteurs en entier et suis leurs liens.
${SOURCES_RULE} Termine par submit_dossier.`,
    tools,
    messages: [
      {
        role: "user",
        content: `Autorité : ${acte.autorite}${acte.collectivite ? ` (${acte.collectivite})` : ""}\nDisposition ${d.id} : ${d.text}\nObjet : ${d.objet}\nMesure : ${d.mesure}\nPérimètre : ${d.perimetre ?? "—"}\nTextes visés par l'acte : ${d.references.join(" ; ") || "aucun"}${opts.cadrage ?? ""}`,
      },
    ],
  });
  for await (const message of runner) {
    meter.add(MODELS.fast, message.usage);
    for (const block of message.content) {
      if (block.type === "tool_use" && block.name !== "submit_dossier") onTool(`${block.name} ${JSON.stringify(block.input)}`);
    }
    if (message.stop_reason === "pause_turn") runner.pushMessages({ role: "assistant", content: message.content });
    if (state.candidates.size) break;
  }
  const notes = state.candidates.get("__notes__") ?? "";
  state.candidates.delete("__notes__");
  return { candidates: state.candidates, notes, consulted: state.consulted };
}

// ---------- 3. Juge ----------

const VerdictSchema = z.object({
  verdict: z.enum(["conflit", "doublon", "vide", "incompetence", "conforme"]),
  severity: z.enum(["critique", "majeure", "mineure", "info"]),
  title: z.string().describe("Titre court de l'alerte, compréhensible par un élu"),
  explanation: z.string().describe("Raisonnement : hiérarchie des normes, compétence, dates. 4 à 8 phrases."),
  citations: z.array(z.object({ article_id: z.string(), quote: z.string().describe("Extrait COPIÉ MOT POUR MOT de l'article, 1 à 2 phrases") })),
  suggestion: z.string().describe("Rédaction corrigée ou action recommandée ; vide si conforme"),
});
export type JudgeOutput = z.infer<typeof VerdictSchema>;

export function articleBlock(articles: FullArticle[], why: Map<string, string>) {
  return articles
    .map((a) => `<article id="${a.id}" niveau="${a.niveau}" source="${a.code_title}" num="${a.num}" etat="${a.etat}" vigueur="${a.date_debut ?? "?"} → ${a.date_fin ?? "…"}">\nPertinence (chercheur) : ${why.get(a.id) ?? "—"}\n${a.text.slice(0, a.niveau === "jurisprudence" ? 7000 : 5000)}\n</article>`)
    .join("\n\n");
}

export async function doctrine(d: Disposition): Promise<string> {
  const rows = await tracedQuery<{ decision: string; reason: string | null; disposition_text: string; finding_verdict: string }>(
    "juge",
    "mémoire (retours juristes)",
    `doctrine pour « ${d.objet} »`,
    `select decision, reason, disposition_text, finding_verdict from feedback, websearch_to_tsquery('french', $1) q
      where tsv @@ q order by ts_rank_cd(tsv, q) desc, created_at desc limit 4`,
    [d.objet.split(/\s+/).slice(0, 6).join(" OR ")],
  );
  if (!rows.length) return "";
  return `\n\nDoctrine interne (retours des juristes sur des cas proches — à respecter) :\n${rows
    .map((r) => `- Une alerte « ${r.finding_verdict} » sur « ${r.disposition_text.slice(0, 160)} » a été ${r.decision === "valide" ? "VALIDÉE" : "REJETÉE comme faux positif"}${r.reason ? ` : ${r.reason}` : ""}.`)
    .join("\n")}`;
}

export async function judge(meter: CostMeter, d: Disposition, articles: FullArticle[], why: Map<string, string>, notes: string, dateActe: string | null, cadrage = ""): Promise<JudgeOutput> {
  return parse(
    meter,
    MODELS.deep,
    "high",
    `Tu es magistrat administratif spécialiste du contrôle de légalité des actes des collectivités. Tu qualifies UNE disposition :
- conflit : contraire à une norme supérieure en vigueur ;
- incompetence : l'autorité n'est pas compétente (ex. police spéciale de l'État) ;
- doublon : répète inutilement une règle déjà posée (loi, code ou acte local existant) ;
- vide : la disposition s'appuie sur un texte absent, abrogé ou non encore pris (décret d'application manquant) ;
- conforme : aucun problème démontrable avec les textes fournis.
Raisonne selon la pyramide des normes : bloc de constitutionnalité (Constitution, DDHC, Préambule de 1946, Charte de l'environnement) > engagements internationaux et droit de l'UE (CEDH, Charte des droits fondamentaux de l'UE, directives) > lois et codes > règlements > actes locaux. La jurisprudence du Conseil d'État (niveau « jurisprudence ») éclaire l'interprétation : cite-la quand une décision a jugé une mesure semblable.
Exige la preuve : chaque citation reprend MOT POUR MOT un passage d'un article fourni (balise <article>), sinon ne la mets pas. Si les textes fournis ne suffisent pas à démontrer un problème, réponds « conforme » avec gravité « info ». La date de référence est ${dateActe ?? "aujourd'hui"}. ${SOURCES_RULE}`,
    `Disposition : ${d.text}\nObjet : ${d.objet}\nMesure : ${d.mesure}\nAutorité : ${d.autorite}\nPérimètre : ${d.perimetre ?? "—"}\n\nNotes du chercheur : ${notes || "—"}${cadrage}\n\nTextes du dossier :\n${articleBlock(articles, why)}${await doctrine(d)}`,
    VerdictSchema,
  );
}

// ---------- 4. Contradicteur ----------

const CritiqueSchema = z.object({
  keep: z.boolean().describe("true si l'alerte résiste à la critique"),
  reason: z.string().describe("Pourquoi l'alerte tient ou tombe, en 2-3 phrases"),
  severity: z.enum(["critique", "majeure", "mineure", "info"]),
});

export async function critic(meter: CostMeter, d: Disposition, finding: JudgeOutput, articles: FullArticle[], codeProblems: string[]) {
  return parse(
    meter,
    MODELS.deep,
    "medium",
    `Tu es l'avocat de la collectivité. Ton rôle est d'attaquer l'alerte du juge : cherche l'erreur de qualification, la norme mal lue, l'exception oubliée, la confusion entre police générale et police spéciale, la date de vigueur. Garde l'alerte seulement si elle est solidement fondée sur les textes fournis. Une préfecture préfère zéro alerte à une fausse alerte. ${SOURCES_RULE}`,
    `Disposition : ${d.text}\n\nAlerte du juge (${finding.verdict}, ${finding.severity}) : ${finding.title}\n${finding.explanation}\nCitations : ${finding.citations.map((c) => `${c.article_id} « ${c.quote} »`).join(" ; ")}\n\nContrôles automatiques : ${codeProblems.length ? codeProblems.join(" ; ") : "citations vérifiées (extraits présents, articles en vigueur)"}\n\nTextes :\n${articleBlock(articles, new Map())}`,
    CritiqueSchema,
  );
}

// ---------- 5. Rédacteur ----------

const SummarySchema = z.object({ headline: z.string().describe("Synthèse en une ou deux phrases pour le maire ou le préfet") });

export async function writer(meter: CostMeter, title: string, findings: Array<{ verdict: Verdict; severity: Severity; title: string; verified: boolean }>) {
  const kept = findings.filter((f) => f.verified && f.verdict !== "conforme");
  if (!kept.length) return { headline: `Aucune irrégularité démontrée dans « ${title} » au regard des textes consultés.` };
  return parse(meter, MODELS.fast, "low", "Tu rédiges la synthèse d'un contrôle de légalité, en français clair, sans jargon inutile.", `Acte : ${title}\nAlertes retenues :\n${kept.map((f) => `- [${f.severity}] ${f.verdict} : ${f.title}`).join("\n")}`, SummarySchema);
}

// ---------- 2 bis. Sous-agents par niveau de la pyramide des normes ----------

export const LEVELS: Array<{ id: string; label: string; niveaux: NiveauFiltre[]; method: string }> = [
  {
    id: "constitution",
    label: "Bloc de constitutionnalité",
    niveaux: ["constitutionnel"],
    method:
      "Tu cherches, pour chaque disposition, les principes constitutionnels en jeu : libertés (aller et venir, entreprendre, expression, culte, propriété — DDHC), libre administration des collectivités (Constitution art. 72), principe de précaution et droit à un environnement sain (Charte de l'environnement), égalité. Utilise search_corpus avec niveau=constitutionnel.",
  },
  {
    id: "international",
    label: "Droit international et de l'UE",
    niveaux: ["international"],
    method:
      "Tu cherches, pour chaque disposition, les normes internationales et européennes en jeu : CEDH (vie privée art. 8, religion art. 9, expression art. 10, réunion art. 11), Charte des droits fondamentaux de l'UE, directive Services (régimes d'autorisation des activités). Utilise search_corpus avec niveau=international et, si un acte UE précis est visé, fetch_eu_act.",
  },
  {
    id: "jurisprudence",
    label: "Jurisprudence administrative",
    niveaux: ["jurisprudence"],
    method:
      "Tu cherches dans les décisions du Conseil d'État (search_jurisprudence) des affaires où une mesure semblable a été jugée : annulation ou validation d'arrêtés municipaux, contrôle de proportionnalité des mesures de police, compétence. Lis les décisions prometteuses (get_article avec l'ECLI) et ne retiens que celles qui tranchent un point utile.",
  },
];

export async function levelResearcher(meter: CostMeter, level: (typeof LEVELS)[number], dispositions: Disposition[], acte: { autorite: string; collectivite: string | null }, onTool: (msg: string) => void, cadrage = "") {
  const state: ResearchState = { candidates: new Map(), consulted: new Set(), assign: new Map() };
  const tools = makeResearchTools(`agent ${level.id}`, state, level.niveaux);
  const runner = anthropic().beta.messages.toolRunner({
    model: MODELS.fast,
    max_tokens: 16000,
    max_iterations: 12,
    output_config: { effort: "medium" },
    ...FALLBACK,
    system: `Tu es l'expert « ${level.label} » d'une équipe de contrôle de légalité. D'autres agents couvrent les codes ; toi tu couvres uniquement ton niveau de la pyramide des normes. ${level.method}
${SOURCES_RULE} Si rien de ton niveau n'est pertinent, rends un dossier avec le texte le plus proche et dis-le dans notes. Termine par submit_dossier en indiquant pour chaque texte les dispositions concernées (d1, d2…).`,
    tools,
    messages: [
      {
        role: "user",
        content: `Autorité : ${acte.autorite}${acte.collectivite ? ` (${acte.collectivite})` : ""}${cadrage}\n\nDispositions :\n${dispositions.map((d) => `${d.id} — ${d.text} (objet : ${d.objet} ; mesure : ${d.mesure})`).join("\n")}`,
      },
    ],
  });
  for await (const message of runner) {
    meter.add(MODELS.fast, message.usage);
    for (const block of message.content) {
      if (block.type === "tool_use" && block.name !== "submit_dossier") onTool(`${block.name} ${JSON.stringify(block.input)}`);
    }
    if (message.stop_reason === "pause_turn") runner.pushMessages({ role: "assistant", content: message.content });
    if (state.candidates.size) break;
  }
  const notes = state.candidates.get("__notes__") ?? "";
  state.candidates.delete("__notes__");
  state.assign?.delete("__notes__");
  return { level, candidates: state.candidates, assign: state.assign!, notes, consulted: state.consulted };
}
