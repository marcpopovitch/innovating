// Cadrage : avant de lancer les agents, on précise la demande (domaine, période,
// périmètre, plus des questions propres à la demande) et on choisit le mode :
// contrôler un texte presque prêt, ou explorer une idée encore floue.
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import type { CadrageQuestion, CadrageResponse, Mode } from "../types";
import { anthropic, CostMeter, FALLBACK, MODELS } from "./llm";

export const BASE_QUESTIONS: CadrageQuestion[] = [
  {
    id: "domaine",
    question: "Quel domaine ?",
    options: ["Police municipale (circulation, bruit, ordre public)", "Environnement et pesticides", "Urbanisme", "Santé publique", "Sécurité"],
    allow_free: true,
    default: null,
  },
  {
    id: "periode",
    question: "Sur quelle période ?",
    options: ["Droit en vigueur aujourd'hui", "Changements des 12 derniers mois", "Changements des 5 dernières années"],
    allow_free: false,
    default: "Droit en vigueur aujourd'hui",
  },
  {
    id: "perimetre",
    question: "Quel périmètre ?",
    options: ["France", "France + droit de l'UE", "France + actes de ma collectivité"],
    allow_free: false,
    default: "France + droit de l'UE",
  },
];

/** Sans IA : un texte d'acte (articles, « arrête ») est à contrôler, une phrase est une idée à explorer. */
export function guessMode(prompt: string): Mode {
  return prompt.length > 400 || /\b(article\s+(1|premier|1er)|arr[êe]te\s*:|d[ée]lib[èe]re\s*:|vu le code)/i.test(prompt) ? "controle" : "exploration";
}

const Extra = z.object({
  mode: z.enum(["controle", "exploration"]),
  title: z.string().describe("Titre court de la conversation, 3 à 7 mots"),
  reformulation: z.string().describe("Ce que tu as compris de la demande, en une phrase"),
  domaine_suggere: z.string().describe("Le domaine le plus probable, formulé comme une des options ou en clair"),
  questions: z
    .array(z.object({ id: z.string(), question: z.string(), options: z.array(z.string()) }))
    .describe("0 à 2 questions propres à CETTE demande, utiles pour mieux chercher (ex. autorité signataire, public visé, commune)"),
});

export async function cadrer(prompt: string): Promise<CadrageResponse> {
  const fallback: CadrageResponse = {
    mode: guessMode(prompt),
    title: prompt.replace(/\s+/g, " ").slice(0, 60),
    reformulation: guessMode(prompt) === "controle" ? "Vous voulez vérifier ce texte contre le droit en vigueur." : "Vous voulez savoir ce qui existe déjà sur ce sujet.",
    questions: BASE_QUESTIONS,
  };
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) return fallback;
  try {
    const meter = new CostMeter();
    const res = await anthropic().beta.messages.parse({
      model: MODELS.fast,
      max_tokens: 2000,
      output_config: { effort: "low", format: betaZodOutputFormat(Extra) },
      ...FALLBACK,
      system:
        "Tu prépares le travail d'agents juridiques pour une mairie ou une préfecture. Deux modes : « controle » si l'utilisateur fournit un texte presque prêt (arrêté, délibération, projet de décret) à vérifier ; « exploration » s'il a une idée et veut savoir ce qui existe déjà. Propose au plus 2 questions propres à la demande, qui changent vraiment la recherche ; jamais de question sur le domaine, la période ou le périmètre (déjà posées).",
      messages: [{ role: "user", content: prompt.slice(0, 20_000) }],
    });
    const out = res.parsed_output;
    if (!out) return fallback;
    const domaine = { ...BASE_QUESTIONS[0], default: out.domaine_suggere || null };
    if (domaine.default && !domaine.options.includes(domaine.default)) domaine.options = [domaine.default, ...domaine.options];
    return {
      mode: out.mode,
      title: out.title,
      reformulation: out.reformulation,
      questions: [domaine, ...BASE_QUESTIONS.slice(1), ...out.questions.slice(0, 2).map((q, i) => ({ id: `q${i + 1}`, question: q.question, options: q.options.slice(0, 5), allow_free: true, default: null }))],
    };
  } catch {
    return fallback;
  }
}

/** Contexte de cadrage injecté dans les prompts des agents. */
export function cadrageText(cadrage: Record<string, string> | null | undefined, questions = BASE_QUESTIONS): string {
  if (!cadrage || !Object.keys(cadrage).length) return "";
  const label = (id: string) => questions.find((q) => q.id === id)?.question.replace(/ \?$/, "") ?? id;
  return `\nCadrage fixé par l'utilisateur : ${Object.entries(cadrage)
    .filter(([, v]) => v)
    .map(([k, v]) => `${label(k)} = ${v}`)
    .join(" ; ")}.`;
}

/** Date plancher correspondant à la période choisie (pour filtrer les textes récents). */
export function periodSince(cadrage: Record<string, string> | null | undefined): string | null {
  const p = cadrage?.periode ?? "";
  const years = /12 derniers mois/.test(p) ? 1 : /5 derni/.test(p) ? 5 : 0;
  if (!years) return null;
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  return d.toISOString().slice(0, 10);
}
