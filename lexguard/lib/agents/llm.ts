// Client Claude partagé, choix des modèles et comptabilité des coûts.
import { AsyncLocalStorage } from "node:async_hooks";
import Anthropic from "@anthropic-ai/sdk";

const DEFAULT_MODELS = {
  fast: process.env.LEXGUARD_FAST_MODEL ?? "claude-sonnet-5-5", // analyste, chercheurs, rédacteur
  deep: process.env.LEXGUARD_DEEP_MODEL ?? "claude-opus-5-5", // juge, contradicteur
};

// Le modèle choisi dans l'interface vaut pour toute une analyse, y compris ses
// sous-agents lancés en parallèle : on le porte dans le contexte asynchrone.
const modelContext = new AsyncLocalStorage<typeof DEFAULT_MODELS>();
export function withModel<T>(deep: string, fn: () => Promise<T>): Promise<T> {
  const fast = deep === "claude-sonnet-5-5" ? deep : DEFAULT_MODELS.fast;
  return modelContext.run({ fast, deep }, fn);
}
export const MODELS = {
  get fast() {
    return modelContext.getStore()?.fast ?? DEFAULT_MODELS.fast;
  },
  get deep() {
    return modelContext.getStore()?.deep ?? DEFAULT_MODELS.deep;
  },
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
