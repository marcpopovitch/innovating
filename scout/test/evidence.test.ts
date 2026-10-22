import { describe, expect, it } from "vitest";
import { evidenceId, Ledger, PodReport, unknownCitations } from "../src/evidence.js";

const fact = {
  claim: "Création : 2021-12-14",
  value: "2021-12-14",
  source: "INSEE",
  url: "https://annuaire-entreprises.data.gouv.fr/entreprise/908311103",
  confidence: "observed" as const,
  authority: "registre-officiel" as const,
};

describe("Evidence", () => {
  it("donne le même id au même fait, quel que soit l'ordre des clés", () => {
    const reordered = { authority: fact.authority, url: fact.url, value: fact.value, claim: fact.claim, source: fact.source, confidence: fact.confidence };
    expect(evidenceId(fact)).toBe(evidenceId(reordered));
    expect(evidenceId(fact)).toMatch(/^ev_[0-9a-f]{12}$/);
  });

  it("change d'id quand le fait change", () => {
    expect(evidenceId(fact)).not.toBe(evidenceId({ ...fact, value: "2022-01-01" }));
  });

  it("est idempotent dans le registre", () => {
    const ledger = new Ledger();
    const a = ledger.add(fact);
    const b = ledger.add(fact);
    expect(a).toBe(b);
    expect(ledger.all()).toHaveLength(1);
  });

  it("refuse un fait dérivé de preuves inconnues", () => {
    const ledger = new Ledger();
    expect(() => ledger.add({ ...fact, confidence: "derived", derived_from: ["ev_000000000000"] })).toThrow(/inconnues/);
  });

  it("signale les citations qui n'existent pas", () => {
    const ledger = new Ledger();
    const known = ledger.add(fact).id;
    const report = PodReport.parse({ summary: "s", metrics: [{ label: "Création", value: "2021", evidence_ids: [known, "ev_ffffffffffff"] }] });
    expect(unknownCitations(report, ledger)).toEqual(["ev_ffffffffffff"]);
  });

  it("refuse un chiffre sans preuve", () => {
    expect(() => PodReport.parse({ summary: "s", metrics: [{ label: "CA", value: "1 M€", evidence_ids: [] }] })).toThrow();
  });
});
