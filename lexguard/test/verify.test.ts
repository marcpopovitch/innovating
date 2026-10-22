import { describe, expect, it } from "vitest";
import { checkCitation, normalize } from "../lib/agents/verify";

const article = {
  id: "LEGIARTI000006390193",
  num: "L2212-2",
  code_title: "Code général des collectivités territoriales",
  text: "La police municipale a pour objet d'assurer le bon ordre, la sûreté, la sécurité et la salubrité publiques.",
  etat: "VIGUEUR",
  date_debut: "2015-01-01",
  date_fin: null,
};

describe("checkCitation", () => {
  it("accepte un extrait présent mot pour mot (casse, accents et guillemets ignorés)", () => {
    expect(checkCitation(article, "« la police municipale a pour objet d’assurer le bon ordre »", "2026-10-22")).toEqual([]);
  });

  it("rejette un extrait inventé", () => {
    expect(checkCitation(article, "Le maire peut interdire les pesticides sur tout le territoire", "2026-10-22")[0]).toMatch(/ne figure pas/);
  });

  it("rejette un article qui n'est plus en vigueur à la date de l'acte", () => {
    const abroge = { ...article, etat: "ABROGE", date_fin: "2020-01-01" };
    expect(checkCitation(abroge, "assurer le bon ordre, la sûreté", "2026-10-22").join()).toMatch(/pas en vigueur/);
  });

  it("rejette un article inconnu et un extrait trop court", () => {
    expect(checkCitation(undefined, "peu importe", null)).toEqual(["article introuvable dans le corpus"]);
    expect(checkCitation(article, "la police", null)[0]).toMatch(/trop court/);
  });

  it("normalise accents et ponctuation", () => {
    expect(normalize("Sûreté, « salubrité »")).toBe("surete salubrite");
  });
});
