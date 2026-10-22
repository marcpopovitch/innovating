// Le circuit IA de bout en bout, sans clé : on simule l'API Anthropic au niveau HTTP.
import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { runPod, synthesize } from "../src/agents.js";
import { evidenceId, Ledger } from "../src/evidence.js";
import type { Identity } from "../src/identity.js";

type Block = Record<string, unknown>;

function fakeApi(turns: Block[][]) {
  const requests: any[] = [];
  const fetch = async (_url: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body));
    requests.push(body);
    const content = turns[requests.length - 1] ?? [{ type: "text", text: "Terminé." }];
    const stop_reason = content.some((b) => b.type === "tool_use") ? "tool_use" : "end_turn";
    return Response.json({
      id: `msg_${requests.length}`,
      type: "message",
      role: "assistant",
      model: body.model,
      content,
      stop_reason,
      stop_sequence: null,
      usage: { input_tokens: 10, output_tokens: 10 },
    });
  };
  return { client: new Anthropic({ apiKey: "test", fetch: fetch as typeof globalThis.fetch, maxRetries: 0 }), requests };
}

function setup() {
  const ledger = new Ledger();
  const known = ledger.add({
    claim: "Dénomination légale : EXEMPLE SAS (SIREN 123456789)",
    source: "API Recherche d'entreprises (INSEE / RNE)",
    url: "https://annuaire-entreprises.data.gouv.fr/entreprise/123456789",
    confidence: "observed",
    authority: "registre-officiel",
  });
  const identity: Identity = {
    input: "exemple.fr",
    domain: "exemple.fr",
    url: "https://exemple.fr/",
    name: "Exemple",
    legalIds: { siren: "123456789" },
    legalName: "EXEMPLE SAS",
    homepage: "Title: Exemple\n\nLe logiciel qui fait gagner du temps.",
    evidenceIds: [known.id],
  };
  return { ledger, identity, known };
}

describe("runPod", () => {
  it("enregistre les preuves, rejette une citation inventée, puis accepte le rapport corrigé", async () => {
    const { ledger, identity, known } = setup();
    const press = {
      claim: "Levée de 4 M€ en seed en mars 2026",
      url: "https://sifted.eu/articles/exemple-seed",
      source: "Sifted",
      as_of: "2026-03",
      confidence: "observed" as const,
      authority: "web" as const,
    };
    const pressId = evidenceId(press);
    const report = (ids: string[]) => ({ summary: "Jeune SaaS français, seed récente.", metrics: [{ label: "Dernière levée", value: "4 M€ seed (mars 2026)", evidence_ids: ids }], unknowns: ["Investisseurs non confirmés"] });

    const { client, requests } = fakeApi([
      [{ type: "tool_use", id: "tu_1", name: "record_evidence", input: press }],
      [{ type: "tool_use", id: "tu_2", name: "submit_report", input: report([known.id, "ev_ffffffffffff"]) }],
      [{ type: "tool_use", id: "tu_3", name: "submit_report", input: report([known.id, pressId]) }],
    ]);

    const run = await runPod(client, "snapshot", identity, ledger, () => {});

    expect(run.submitted).toBe(true);
    expect(run.report.metrics[0].evidence_ids).toEqual([known.id, pressId]);
    // La citation inventée a été renvoyée au modèle comme une erreur.
    const rejected = requests[2].messages.at(-1).content[0];
    expect(rejected).toMatchObject({ tool_use_id: "tu_2", is_error: true });
    expect(JSON.stringify(rejected.content)).toContain("ev_ffffffffffff");
    // L'URL de presse n'a jamais été lue ni renvoyée par la recherche : elle est signalée.
    expect(ledger.get(pressId)?.limitations).toContain("URL non consultée par l'agent : à vérifier");
    // La requête porte bien le modèle, l'effort, le repli et la recherche web.
    expect(requests[0]).toMatchObject({ model: "claude-sonnet-5-5", output_config: { effort: "medium" }, fallbacks: "default" });
    expect(requests[0].tools.map((t: Block) => t.name)).toEqual(expect.arrayContaining(["registry_lookup", "record_evidence", "submit_report", "web_search"]));
    expect(requests[0].messages[0].content).toContain(known.id);
  });

  it("ne signale pas une URL renvoyée par la recherche web", async () => {
    const { ledger, identity, known } = setup();
    const url = "https://www.maddyness.com/exemple";
    const fact = { claim: "Client : Decathlon", url, source: "Maddyness", confidence: "observed" as const, authority: "web" as const };
    const { client } = fakeApi([
      [
        { type: "server_tool_use", id: "srv_1", name: "web_search", input: { query: "Exemple clients" } },
        { type: "web_search_tool_result", tool_use_id: "srv_1", content: [{ type: "web_search_result", url, title: "Exemple", encrypted_content: "x", page_age: null }] },
        { type: "tool_use", id: "tu_1", name: "record_evidence", input: fact },
      ],
      [{ type: "tool_use", id: "tu_2", name: "submit_report", input: { summary: "s", metrics: [{ label: "Client", value: "Decathlon", evidence_ids: [evidenceId(fact), known.id] }] } }],
    ]);
    const run = await runPod(client, "icp", identity, ledger, () => {});
    expect(run.steps).toContain('web_search "Exemple clients"');
    expect(ledger.get(evidenceId(fact))?.limitations).toEqual([]);
  });

  it("rend un rapport « incomplet » si l'agent ne soumet rien", async () => {
    const { ledger, identity } = setup();
    const { client } = fakeApi([[{ type: "text", text: "Je n'ai rien trouvé." }]]);
    const run = await runPod(client, "market", identity, ledger, () => {});
    expect(run.submitted).toBe(false);
    expect(run.report.unknowns).toContain("Pod incomplet");
  });
});

describe("synthesize", () => {
  it("renvoie une note de comité structurée", async () => {
    const { ledger, identity, known } = setup();
    const note = {
      one_liner: "Logiciel qui fait gagner du temps aux PME.",
      verdict: "Équipe solide, marché encombré.",
      bull_case: [{ point: "Entité légale claire", evidence_ids: [known.id] }],
      bear_case: [{ point: "Aucun compte publié", evidence_ids: [known.id] }],
      red_flags: [],
      questions_for_founders: ["Quel est votre ARR ?"],
    };
    const { client, requests } = fakeApi([[{ type: "text", text: JSON.stringify(note) }]]);
    const synthesis = await synthesize(client, identity, [], ledger.all());
    expect(synthesis).toEqual(note);
    expect(requests[0]).toMatchObject({ model: "claude-opus-5-5", output_config: { effort: "high", format: { type: "json_schema" } } });
  });
});
