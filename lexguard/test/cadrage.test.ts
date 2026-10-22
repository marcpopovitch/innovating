import { describe, expect, it } from "vitest";
import { BASE_QUESTIONS, cadrageText, cadrer, guessMode, periodSince } from "../lib/agents/cadrage";

describe("cadrage", () => {
  it("devine le mode : texte d'acte → contrôle, idée → exploration", () => {
    expect(guessMode("Le Maire, Vu le code général des collectivités territoriales, ARRÊTE : Article 1er : …")).toBe("controle");
    expect(guessMode("Je voudrais interdire les trottinettes en libre-service dans le centre")).toBe("exploration");
  });

  it("pose les questions de base sans clé API", async () => {
    const saved = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    const r = await cadrer("Je voudrais interdire les trottinettes en libre-service");
    process.env.ANTHROPIC_API_KEY = saved;
    expect(r.mode).toBe("exploration");
    expect(r.questions.map((q) => q.id)).toEqual(["domaine", "periode", "perimetre"]);
  });

  it("transforme les réponses en contexte et en date plancher", () => {
    expect(cadrageText({ domaine: "Urbanisme", periode: "Droit en vigueur aujourd'hui" }, BASE_QUESTIONS)).toContain("Quel domaine = Urbanisme");
    expect(periodSince({ periode: "Changements des 5 dernières années" })).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(periodSince({ periode: "Droit en vigueur aujourd'hui" })).toBeNull();
  });
});
