// Client Claude partagé, choix des modèles et comptabilité des coûts.
import Anthropic from "@anthropic-ai/sdk";

export const MODELS = {
  fast: process.env.LEXGUARD_FAST_MODEL ?? "claude-sonnet-5-5", // analyste, chercheurs, rédacteur
  deep: process.env.LEXGUARD_DEEP_MODEL ?? "claude-opus-5-5", // juge, contradicteur
};

// Prix publics par million de tokens (entrée, sortie), octobre 2026.
const PRICES: Record<string, [number, number]> = {
  "claude-sonnet-5-5": [2, 10],
  "claude-opus-5-5": [4, 20],
  "claude-haiku-5-5": [0.1, 0.5],
};

// Si un modèle décline pour raison de politique, l'API rejoue la requête sur son repli par défaut.
export const FALLBACK = { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const };

let client: Anthropic | null = null;
export function anthropic(): Anthropic {
  client ??= new Anthropic();
  return client;
}
export function setAnthropicClient(c: Anthropic) {
  client = c;
}

/** Accumule le coût d'une analyse à partir du champ usage de chaque réponse. */
export class CostMeter {
  usd = 0;
  calls = 0;
  add(model: string, usage: { input_tokens?: number | null; output_tokens?: number | null; cache_read_input_tokens?: number | null } | undefined) {
    if (!usage) return;
    const [inp, out] = PRICES[model] ?? PRICES["claude-opus-5-5"];
    this.usd += ((usage.input_tokens ?? 0) * inp + (usage.cache_read_input_tokens ?? 0) * inp * 0.1 + (usage.output_tokens ?? 0) * out) / 1e6;
    this.calls += 1;
  }
}
