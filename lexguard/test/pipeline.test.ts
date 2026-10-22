// L'équipe d'agents de bout en bout, sans clé : base PGlite en mémoire et API
// Anthropic simulée au niveau HTTP (chaque rôle reconnu par son prompt système).
import Anthropic from "@anthropic-ai/sdk";
import { beforeAll, describe, expect, it } from "vitest";

process.env.PGLITE_DIR = "memory://";

const RURAL = {
  id: "LEGIARTI000043000001",
  num: "L253-7",
  text: "L'autorité administrative peut, dans l'intérêt de la santé publique ou de l'environnement, prendre toute mesure d'interdiction, de restriction ou de prescription particulière concernant la mise sur le marché, la délivrance, l'utilisation et la détention des produits mentionnés à l'article L. 253-1.",
};
const CGCT = {
  id: "LEGIARTI000006390193",
  num: "L2212-2",
  text: "La police municipale a pour objet d'assurer le bon ordre, la sûreté, la sécurité et la salubrité publiques.",
};

type Judge = { quote: string; keep: boolean };

function fakeApi(judgeReply: Judge) {
  const calls: string[] = [];
  const fetch = async (_url: unknown, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body));
    const system = String(body.system ?? "");
    const last = body.messages.at(-1);
    let content: unknown[];
    if (system.includes("découpes")) {
      calls.push("analyste");
      content = [{ type: "text", text: JSON.stringify({ autorite: "Le maire de Testville", dispositions: [{ text: "L'utilisation de produits phytopharmaceutiques est interdite sur le territoire communal.", objet: "interdiction des pesticides", mesure: "interdiction générale", autorite: "maire", perimetre: "territoire communal", references: ["CGCT L2212-2"] }] }) }];
    } else if (system.includes("chercheur juridique")) {
      const afterTool = Array.isArray(last.content) && last.content[0]?.type === "tool_result";
      if (afterTool && JSON.stringify(last.content).includes("Dossier reçu")) {
        calls.push("chercheur:fin");
        content = [{ type: "text", text: "Terminé." }];
      } else {
        calls.push(afterTool ? "chercheur:dossier" : "chercheur:recherche");
        content = afterTool
          ? [{ type: "tool_use", id: "tu_2", name: "submit_dossier", input: { candidates: [{ article_id: RURAL.id, why: "police spéciale des pesticides" }, { article_id: CGCT.id, why: "police générale du maire" }], notes: "Police spéciale confiée à l'État." } }]
          : [{ type: "tool_use", id: "tu_1", name: "search_corpus", input: { query: "produits phytopharmaceutiques interdiction" } }];
      }
    } else if (system.includes("magistrat")) {
      calls.push("juge");
      content = [{ type: "text", text: JSON.stringify({ verdict: "incompetence", severity: "critique", title: "Le maire n'est pas compétent pour interdire les pesticides", explanation: "Police spéciale confiée à l'État.", citations: [{ article_id: RURAL.id, quote: judgeReply.quote }], suggestion: "Retirer l'article ou saisir le préfet." }) }];
    } else if (system.includes("avocat")) {
      calls.push("contradicteur");
      content = [{ type: "text", text: JSON.stringify({ keep: judgeReply.keep, reason: "La police spéciale prime.", severity: "critique" }) }];
    } else {
      calls.push("redacteur");
      content = [{ type: "text", text: JSON.stringify({ headline: "Arrêté illégal : incompétence du maire." }) }];
    }
    const stop = content.some((b) => (b as { type: string }).type === "tool_use") ? "tool_use" : "end_turn";
    return Response.json({ id: `msg_${calls.length}`, type: "message", role: "assistant", model: body.model, content, stop_reason: stop, stop_sequence: null, usage: { input_tokens: 1000, output_tokens: 200 } });
  };
  return { client: new Anthropic({ apiKey: "test", fetch: fetch as typeof globalThis.fetch, maxRetries: 0 }), calls };
}

let mod: typeof import("../lib/agents/orchestrator");
let llm: typeof import("../lib/agents/llm");
let dbmod: typeof import("../lib/db");

beforeAll(async () => {
  dbmod = await import("../lib/db");
  llm = await import("../lib/agents/llm");
  mod = await import("../lib/agents/orchestrator");
  const client = await dbmod.db();
  for (const [a, code] of [[RURAL, "Code rural et de la pêche maritime"], [CGCT, "Code général des collectivités territoriales"]] as const) {
    await client.query("insert into articles (id, code_id, code_title, num, text, etat, date_debut) values ($1, 'X', $2, $3, $4, 'VIGUEUR', '2020-01-01')", [a.id, code, a.num, a.text]);
  }
});

async function run(judge: Judge) {
  const { client, calls } = fakeApi(judge);
  llm.setAnthropicClient(client);
  const id = await mod.createAnalysis({ title: "Arrêté anti-pesticides", input: "Article 1 : l'utilisation de produits phytopharmaceutiques est interdite sur le territoire communal.", collectivite: "Testville", date_acte: "2026-10-01" });
  await mod.runAnalysis(id);
  const c = await dbmod.db();
  const findings = (await c.query<{ verdict: string; verified: boolean; rejection_reason: string | null; citations: Array<{ url: string }> }>("select verdict, verified, rejection_reason, citations from findings where analysis_id = $1", [id])).rows;
  const analysis = (await c.query<{ status: string; cost_usd: string; summary: { counts: Record<string, number> } }>("select status, cost_usd, summary from analyses where id = $1", [id])).rows[0];
  const events = (await c.query<{ agent: string; type: string }>("select agent, type from events where analysis_id = $1 order by id", [id])).rows;
  const log = (await c.query<{ actor: string }>("select actor from query_log")).rows;
  return { calls, findings, analysis, events, log };
}

describe("équipe d'agents", () => {
  it("enchaîne analyste → chercheur (plusieurs étapes) → juge → contradicteur → rédacteur et garde une alerte vérifiée", async () => {
    const r = await run({ quote: "prendre toute mesure d'interdiction, de restriction ou de prescription particulière concernant", keep: true });
    expect(r.calls).toEqual(["analyste", "chercheur:recherche", "chercheur:dossier", "chercheur:fin", "juge", "contradicteur", "redacteur"]);
    expect(r.findings).toHaveLength(1);
    expect(r.findings[0]).toMatchObject({ verdict: "incompetence", verified: true, rejection_reason: null });
    expect(r.findings[0].citations[0].url).toBe(`https://www.legifrance.gouv.fr/codes/article_lc/${RURAL.id}`);
    expect(r.analysis.status).toBe("termine");
    expect(r.analysis.summary.counts.incompetence).toBe(1);
    expect(Number(r.analysis.cost_usd)).toBeGreaterThan(0);
    expect(r.events.at(-1)).toMatchObject({ type: "fin" });
    expect(r.log.some((l) => l.actor === "chercheur d1")).toBe(true); // la recherche a bien interrogé la base
  });

  it("écarte une alerte dont l'extrait cité n'existe pas, même si le contradicteur la garde", async () => {
    const r = await run({ quote: "Le maire est seul compétent pour interdire les pesticides sur sa commune", keep: true });
    expect(r.findings[0].verified).toBe(false);
    expect(r.findings[0].rejection_reason).toMatch(/ne figure pas/);
    expect(r.events.some((e) => e.agent === "contradicteur" && e.type === "rejet")).toBe(true);
  });
});
