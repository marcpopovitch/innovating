// Accès aux modèles. Trois fournisseurs, même interface pour les agents :
// - OpenAI direct (OPENAI_API_KEY) : les modèles GPT ;
// - OpenRouter (OPENROUTER_API_KEY) : une seule clé pour Claude, GPT, Mistral, Gemini ;
// - Anthropic direct (ANTHROPIC_API_KEY) : Claude.
// Les agents n'appellent que structured() (sortie JSON validée) et toolLoop() (agent à outils).
import { AsyncLocalStorage } from "node:async_hooks";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { BetaRunnableTool } from "@anthropic-ai/sdk/lib/tools/BetaRunnableTool";
import { z } from "zod";
import { MODEL_CHOICES } from "../types";

// Trois rôles :
// - fast : sous-agents à outils (chercheurs, experts, analyste), le modèle le moins cher qui tient l'usage d'outils ;
// - deep : le jugement, avec le modèle choisi dans l'interface ;
// - router : Jev (TypeSafe), branché d'office sur les étapes de langage sans outils qui dépendent de la
//   demande (questions de cadrage, angles de recherche, veille, synthèse) ; il choisit le modèle à chaque requête.
const DEFAULT_MODELS = {
  fast: process.env.LEXGUARD_FAST_MODEL ?? "gpt-6-luna",
  deep: process.env.LEXGUARD_DEEP_MODEL ?? "gpt-6-luna",
  router: process.env.LEXGUARD_ROUTER_MODEL ?? "jev",
};

// Le modèle choisi vaut pour toute une analyse, y compris ses sous-agents parallèles.
const modelContext = new AsyncLocalStorage<typeof DEFAULT_MODELS>();
export function withModel<T>(deep: string, fn: () => Promise<T>): Promise<T> {
  return modelContext.run({ ...DEFAULT_MODELS, deep }, fn);
}
export const MODELS = {
  get fast() {
    return modelContext.getStore()?.fast ?? DEFAULT_MODELS.fast;
  },
  get deep() {
    return modelContext.getStore()?.deep ?? DEFAULT_MODELS.deep;
  },
  get router() {
    return modelContext.getStore()?.router ?? DEFAULT_MODELS.router;
  },
};

const env = () => ({
  openai: !!process.env.OPENAI_API_KEY,
  openrouter: !!process.env.OPENROUTER_API_KEY,
  anthropic: !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN),
});
export const hasLlmKey = () => Object.values(env()).some(Boolean);

const choice = (id: string) => MODEL_CHOICES.find((m) => m.id === id);

// Prix réels des modèles OpenAI exécutés derrière les choix de l'interface ($ / M tokens).
const BACKEND_PRICES: Record<string, [number, number]> = { "gpt-6-luna": [0.1, 0.5], "gpt-6-sol": [2, 10] };

type Route = { kind: "openai" | "openrouter" | "anthropic"; model: string; priceId: string };
/**
 * Choix produit : Jev (étapes de langage) passe par OpenRouter ; tout le reste est exécuté par OpenAI
 * avec le modèle de même gamme (MODEL_CHOICES.backend). Sans clé OpenRouter, Jev est remplacé par
 * GPT-6 Luna ; sans clé OpenAI, repli sur OpenRouter puis sur Anthropic.
 */
function route(id: string): Route {
  const e = env();
  const c = choice(id);
  if (id === "jev" && e.openrouter) return { kind: "openrouter", model: "typesafe/jev-router", priceId: "jev" };
  if (e.openai) {
    const backend = c?.backend ?? "gpt-6-luna";
    return { kind: "openai", model: backend, priceId: backend };
  }
  if (e.openrouter) return { kind: "openrouter", model: c?.openrouter ?? id, priceId: id };
  if (e.anthropic) return { kind: "anthropic", model: c?.provider === "anthropic" ? c.id : "claude-sonnet-5-5", priceId: c?.provider === "anthropic" ? c.id : "claude-sonnet-5-5" };
  throw new Error("Aucune clé de modèle (OPENAI_API_KEY, OPENROUTER_API_KEY ou ANTHROPIC_API_KEY).");
}

// Si un modèle décline pour raison de politique, l'API Anthropic rejoue la requête sur son repli.
export const FALLBACK = { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const };

let client: Anthropic | null = null;
export function anthropic(): Anthropic {
  client ??= new Anthropic();
  return client;
}
export function setAnthropicClient(c: Anthropic) {
  client = c;
}

/** Accumule le coût d'une analyse (prix publics OpenRouter = prix éditeurs). */
export class CostMeter {
  usd = 0;
  calls = 0;
  add(model: string, usage: { input_tokens?: number | null; output_tokens?: number | null; cache_read_input_tokens?: number | null; cost?: number | null } | undefined) {
    if (!usage) return;
    this.calls += 1;
    // OpenRouter facture certains modèles au prix réel du modèle routé : il le renvoie dans usage.cost.
    if (typeof usage.cost === "number") {
      this.usd += usage.cost;
      return;
    }
    const [inp, out] = BACKEND_PRICES[model] ?? choice(model)?.price ?? (model.includes("opus") ? [4, 20] : model.includes("sonnet") ? [2, 10] : [0.1, 0.5]);
    this.usd += ((usage.input_tokens ?? 0) * inp + (usage.cache_read_input_tokens ?? 0) * inp * 0.1 + (usage.output_tokens ?? 0) * out) / 1e6;
  }
}

type Effort = "low" | "medium" | "high";

// ---------- OpenRouter (API compatible OpenAI) ----------

interface ORMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: Array<{ id: string; type: "function"; function: { name: string; arguments: string } }>;
  tool_call_id?: string;
}

/** API « chat completions » (OpenAI et OpenRouter partagent le format). */
async function chatCompletions(r: Route, body: Record<string, unknown>) {
  const openai = r.kind === "openai";
  const { max_tokens, reasoning, ...rest } = body as { max_tokens?: number; reasoning?: { effort: string } } & Record<string, unknown>;
  const payload = openai
    ? { ...rest, model: r.model, max_completion_tokens: max_tokens, reasoning_effort: reasoning?.effort }
    : { ...rest, model: r.model, max_tokens, reasoning, usage: { include: true } };
  const res = await fetch(openai ? "https://api.openai.com/v1/chat/completions" : "https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${openai ? process.env.OPENAI_API_KEY : process.env.OPENROUTER_API_KEY}`,
      "content-type": "application/json",
      ...(openai ? {} : { "x-title": "Ciceron" }),
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(300_000),
  });
  if (!res.ok) throw new Error(`${openai ? "OpenAI" : "OpenRouter"} ${res.status} : ${(await res.text()).slice(0, 300)}`);
  return (await res.json()) as {
    choices: Array<{ message: ORMessage; finish_reason: string }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number; cost?: number };
  };
}
const orUsage = (u?: { prompt_tokens?: number; completion_tokens?: number; cost?: number }) => ({ input_tokens: u?.prompt_tokens ?? 0, output_tokens: u?.completion_tokens ?? 0, cost: u?.cost ?? null });

// ---------- Interface commune ----------

/** Un appel, une réponse JSON validée par le schéma Zod. */
export async function structured<T extends z.ZodType>(meter: CostMeter, model: string, effort: Effort, system: string, user: string, schema: T, maxTokens = 16000): Promise<z.infer<T>> {
  const r = route(model);
  if (r.kind !== "anthropic") {
    const res = await chatCompletions(r, {
      max_tokens: maxTokens,
      reasoning: { effort },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_schema", json_schema: { name: "reponse", strict: true, schema: z.toJSONSchema(schema) } },
    });
    meter.add(r.priceId, orUsage(res.usage));
    const text = res.choices[0]?.message.content ?? "";
    return schema.parse(JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, "")));
  }
  const response = await anthropic().beta.messages.parse({
    model: r.model,
    max_tokens: maxTokens,
    output_config: { effort, format: betaZodOutputFormat(schema) },
    ...FALLBACK,
    system,
    messages: [{ role: "user", content: user }],
  });
  meter.add(r.priceId, response.usage);
  if (response.stop_reason === "refusal" || !response.parsed_output) throw new Error(`Réponse inexploitable (${response.stop_reason})`);
  return response.parsed_output as z.infer<T>;
}

export interface ToolLoopOptions {
  system: string;
  user: string;
  tools: BetaRunnableTool[];
  maxIterations: number;
  effort?: Effort;
  onToolUse?: (name: string, input: unknown) => void;
  isDone: () => boolean; // l'agent a rendu son travail (ex. submit_dossier accepté)
}

/** Agent à outils : boucle appel → outils → appel, jusqu'à isDone() ou la limite d'itérations. */
export async function toolLoop(meter: CostMeter, model: string, o: ToolLoopOptions): Promise<void> {
  const r = route(model);
  if (r.kind !== "anthropic") {
    const messages: ORMessage[] = [
      { role: "system", content: o.system },
      { role: "user", content: o.user },
    ];
    const tools = o.tools.map((t) => {
      const def = t as unknown as { name: string; description?: string; input_schema: unknown };
      return { type: "function", function: { name: def.name, description: def.description, parameters: def.input_schema } };
    });
    for (let i = 0; i < o.maxIterations && !o.isDone(); i++) {
      const res = await chatCompletions(r, { max_tokens: 16000, reasoning: { effort: o.effort ?? "medium" }, messages, tools, tool_choice: "auto" });
      meter.add(r.priceId, orUsage(res.usage));
      const msg = res.choices[0]?.message;
      if (!msg) break;
      messages.push({ role: "assistant", content: msg.content ?? null, tool_calls: msg.tool_calls });
      if (!msg.tool_calls?.length) break;
      for (const call of msg.tool_calls) {
        const tool = o.tools.find((t) => t.name === call.function.name);
        let content: string;
        try {
          if (!tool) throw new Error(`Outil inconnu : ${call.function.name}`);
          const input = tool.parse(JSON.parse(call.function.arguments || "{}"));
          if (tool.name !== "submit_dossier") o.onToolUse?.(tool.name, input);
          const out = await tool.run(input);
          content = typeof out === "string" ? out : JSON.stringify(out);
        } catch (error) {
          content = `Erreur : ${error instanceof Error ? error.message : String(error)}`;
        }
        messages.push({ role: "tool", tool_call_id: call.id, content });
      }
    }
    return;
  }
  const runner = anthropic().beta.messages.toolRunner({
    model: r.model,
    max_tokens: 16000,
    max_iterations: o.maxIterations,
    output_config: { effort: o.effort ?? "medium" },
    ...FALLBACK,
    system: o.system,
    tools: o.tools,
    messages: [{ role: "user", content: o.user }],
  });
  for await (const message of runner) {
    meter.add(r.priceId, message.usage);
    for (const block of message.content) {
      if (block.type === "tool_use" && block.name !== "submit_dossier") o.onToolUse?.(block.name, block.input);
    }
    if (message.stop_reason === "pause_turn") runner.pushMessages({ role: "assistant", content: message.content });
    if (o.isDone()) break;
  }
}
