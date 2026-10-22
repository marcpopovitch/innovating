// Le chemin OpenRouter (une clé pour tous les modèles), sans réseau : fetch simulé.
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { CostMeter, structured, toolLoop } from "../lib/agents/llm";

const bodies: any[] = [];
beforeEach(() => {
  process.env.OPENROUTER_API_KEY = "test";
  bodies.length = 0;
});
afterEach(() => {
  delete process.env.OPENROUTER_API_KEY;
  delete process.env.OPENAI_API_KEY;
  vi.unstubAllGlobals();
});

function reply(message: object) {
  return Response.json({ choices: [{ message, finish_reason: "stop" }], usage: { prompt_tokens: 1_000_000, completion_tokens: 0 } });
}

describe("OpenRouter", () => {
  it("structured : envoie le schéma JSON, valide la réponse et compte le coût du modèle choisi", async () => {
    vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
      bodies.push(JSON.parse(String(init.body)));
      return reply({ role: "assistant", content: '{"verdict":"conforme"}' });
    });
    const meter = new CostMeter();
    const out = await structured(meter, "mistral-large-4", "low", "sys", "user", z.object({ verdict: z.enum(["conforme", "conflit"]) }));
    expect(out).toEqual({ verdict: "conforme" });
    expect(bodies[0].model).toBe("mistralai/mistral-large-4-0");
    expect(bodies[0].response_format.json_schema.schema.properties.verdict.enum).toEqual(["conforme", "conflit"]);
    expect(meter.usd).toBeCloseTo(1.36); // 1 M tokens d'entrée au prix de Mistral Large 4
  });

  it("toolLoop : exécute les outils demandés et s'arrête quand le travail est rendu", async () => {
    let step = 0;
    vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
      bodies.push(JSON.parse(String(init.body)));
      step += 1;
      if (step === 1) return reply({ role: "assistant", content: null, tool_calls: [{ id: "c1", type: "function", function: { name: "search", arguments: '{"q":"pesticides"}' } }] });
      return reply({ role: "assistant", content: null, tool_calls: [{ id: "c2", type: "function", function: { name: "submit", arguments: '{"ids":["A"]}' } }] });
    });
    const found: string[] = [];
    let done = false;
    const tools = [
      betaZodTool({ name: "search", description: "cherche", inputSchema: z.object({ q: z.string() }), run: async ({ q }) => `résultats pour ${q}` }),
      betaZodTool({ name: "submit", description: "rend", inputSchema: z.object({ ids: z.array(z.string()) }), run: async ({ ids }) => ((done = true), found.push(...ids), "ok") }),
    ];
    const seen: string[] = [];
    await toolLoop(new CostMeter(), "claude-haiku-5-5", { system: "s", user: "u", tools, maxIterations: 5, onToolUse: (n) => seen.push(n), isDone: () => done });
    expect(found).toEqual(["A"]);
    expect(seen).toEqual(["search", "submit"]);
    expect(bodies).toHaveLength(2);
    expect(bodies[0].model).toBe("anthropic/claude-haiku-5.5");
    expect(bodies[1].messages.at(-1)).toMatchObject({ role: "tool", tool_call_id: "c1", content: "résultats pour pesticides" });
  });

  it("GPT passe par OpenAI en direct quand OPENAI_API_KEY existe, le reste par OpenRouter", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    const urls: string[] = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      urls.push(url);
      bodies.push(JSON.parse(String(init.body)));
      return reply({ role: "assistant", content: '{"ok":true}' });
    });
    const schema = z.object({ ok: z.boolean() });
    await structured(new CostMeter(), "gpt-6-luna", "low", "s", "u", schema);
    await structured(new CostMeter(), "mistral-large-4", "low", "s", "u", schema);
    expect(urls).toEqual(["https://api.openai.com/v1/chat/completions", "https://openrouter.ai/api/v1/chat/completions"]);
    expect(bodies[0]).toMatchObject({ model: "gpt-6-luna", max_completion_tokens: 16000, reasoning_effort: "low" });
    expect(bodies[0].max_tokens).toBeUndefined();
  });
});
