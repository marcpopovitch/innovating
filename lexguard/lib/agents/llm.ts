// Accès aux modèles. Deux fournisseurs, même interface pour les agents :
// - OpenRouter (OPENROUTER_API_KEY) : une seule clé pour Claude, GPT, Mistral, Gemini ;
// - Anthropic direct (ANTHROPIC_API_KEY) : Claude uniquement.
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

export const hasLlmKey = () => !!(process.env.OPENROUTER_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
const useOpenRouter = () => !!process.env.OPENROUTER_API_KEY;

const choice = (id: string) => MODEL_CHOICES.find((m) => m.id === id);
/** Identifiant à envoyer au fournisseur. Sans OpenRouter, un modèle non-Claude retombe sur Claude Sonnet. */
function providerModel(id: string): string {
  const c = choice(id);
  if (useOpenRouter()) return c?.openrouter ?? id;
  return c?.provider === "anthropic" ? c.id : id.startsWith("claude-") ? id : "claude-sonnet-5-5";
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

async function openRouter(body: Record<string, unknown>) {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "content-type": "application/json",
      "x-title": "Ciceron",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(300_000),
  });
  if (!res.ok) throw new Error(`OpenRouter ${res.status} : ${(await res.text()).slice(0, 300)}`);
  return (await res.json()) as {
    choices: Array<{ message: ORMessage; finish_reason: string }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
}
const orUsage = (u?: { prompt_tokens?: number; completion_tokens?: number }) => ({ input_tokens: u?.prompt_tokens ?? 0, output_tokens: u?.completion_tokens ?? 0 });

// ---------- Interface commune ----------

/** Un appel, une réponse JSON validée par le schéma Zod. */
export async function structured<T extends z.ZodType>(meter: CostMeter, model: string, effort: Effort, system: string, user: string, schema: T, maxTokens = 16000): Promise<z.infer<T>> {
  if (useOpenRouter()) {
    const res = await openRouter({
      model: providerModel(model),
      max_tokens: maxTokens,
      reasoning: { effort },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_schema", json_schema: { name: "reponse", strict: true, schema: z.toJSONSchema(schema) } },
    });
    meter.add(model, orUsage(res.usage));
    const text = res.choices[0]?.message.content ?? "";
    return schema.parse(JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, "")));
  }
  const response = await anthropic().beta.messages.parse({
    model: providerModel(model),
    max_tokens: maxTokens,
    output_config: { effort, format: betaZodOutputFormat(schema) },
    ...FALLBACK,
    system,
    messages: [{ role: "user", content: user }],
  });
  meter.add(model, response.usage);
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
  if (useOpenRouter()) {
    const messages: ORMessage[] = [
      { role: "system", content: o.system },
      { role: "user", content: o.user },
    ];
    const tools = o.tools.map((t) => {
      const def = t as unknown as { name: string; description?: string; input_schema: unknown };
      return { type: "function", function: { name: def.name, description: def.description, parameters: def.input_schema } };
    });
    for (let i = 0; i < o.maxIterations && !o.isDone(); i++) {
      const res = await openRouter({ model: providerModel(model), max_tokens: 16000, reasoning: { effort: o.effort ?? "medium" }, messages, tools, tool_choice: "auto" });
      meter.add(model, orUsage(res.usage));
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
    model: providerModel(model),
    max_tokens: 16000,
    max_iterations: o.maxIterations,
    output_config: { effort: o.effort ?? "medium" },
    ...FALLBACK,
    system: o.system,
    tools: o.tools,
    messages: [{ role: "user", content: o.user }],
  });
  for await (const message of runner) {
    meter.add(model, message.usage);
    for (const block of message.content) {
      if (block.type === "tool_use" && block.name !== "submit_dossier") o.onToolUse?.(block.name, block.input);
    }
    if (message.stop_reason === "pause_turn") runner.pushMessages({ role: "assistant", content: message.content });
    if (o.isDone()) break;
  }
}
