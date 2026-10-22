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

// Sous-agents (chercheurs, experts, analyste) : le modèle le moins cher qui tient
// l'usage d'outils. Le modèle choisi dans l'interface fait le jugement.
const DEFAULT_MODELS = {
  fast: process.env.LEXGUARD_FAST_MODEL ?? "claude-haiku-5-5",
  deep: process.env.LEXGUARD_DEEP_MODEL ?? "claude-haiku-5-5",
};

// Le modèle choisi vaut pour toute une analyse, y compris ses sous-agents parallèles.
const modelContext = new AsyncLocalStorage<typeof DEFAULT_MODELS>();
export function withModel<T>(deep: string, fn: () => Promise<T>): Promise<T> {
  return modelContext.run({ fast: DEFAULT_MODELS.fast, deep }, fn);
}
export const MODELS = {
  get fast() {
    return modelContext.getStore()?.fast ?? DEFAULT_MODELS.fast;
  },
  get deep() {
    return modelContext.getStore()?.deep ?? DEFAULT_MODELS.deep;
  },
};

const env = () => ({
  openai: !!process.env.OPENAI_API_KEY,
  openrouter: !!process.env.OPENROUTER_API_KEY,
  anthropic: !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN),
});
export const hasLlmKey = () => Object.values(env()).some(Boolean);

const choice = (id: string) => MODEL_CHOICES.find((m) => m.id === id);

type Route = { kind: "openai" | "openrouter" | "anthropic"; model: string; priceId: string };
/**
 * Choisit le fournisseur d'un modèle selon les clés présentes : GPT passe par OpenAI si sa clé
 * existe, tout le reste par OpenRouter, sinon Claude par Anthropic. Un modèle injoignable
 * retombe sur un modèle disponible (GPT-6 Luna avec la seule clé OpenAI).
 */
function route(id: string): Route {
  const e = env();
  const c = choice(id);
  if (c?.provider === "openai" && e.openai) return { kind: "openai", model: c.openrouter.replace(/^openai\//, ""), priceId: id };
  if (e.openrouter) return { kind: "openrouter", model: c?.openrouter ?? id, priceId: id };
  if (e.anthropic && (c?.provider === "anthropic" || id.startsWith("claude-"))) return { kind: "anthropic", model: id, priceId: id };
  if (e.openai) return { kind: "openai", model: "gpt-6-luna", priceId: "gpt-6-luna" };
  if (e.anthropic) return { kind: "anthropic", model: "claude-sonnet-5-5", priceId: "claude-sonnet-5-5" };
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
  add(model: string, usage: { input_tokens?: number | null; output_tokens?: number | null; cache_read_input_tokens?: number | null } | undefined) {
    if (!usage) return;
    const [inp, out] = choice(model)?.price ?? (model.includes("opus") ? [4, 20] : model.includes("sonnet") ? [2, 10] : [0.1, 0.5]);
    this.usd += ((usage.input_tokens ?? 0) * inp + (usage.cache_read_input_tokens ?? 0) * inp * 0.1 + (usage.output_tokens ?? 0) * out) / 1e6;
    this.calls += 1;
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
    : { ...rest, model: r.model, max_tokens, reasoning };
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
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
}
const orUsage = (u?: { prompt_tokens?: number; completion_tokens?: number }) => ({ input_tokens: u?.prompt_tokens ?? 0, output_tokens: u?.completion_tokens ?? 0 });

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
