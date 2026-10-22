import { afterEach, describe, expect, it, vi } from "vitest";
import { type CompanyRecord, registryEvidence } from "../src/sources/registry.js";
import { jobsEvidence } from "../src/sources/signals.js";
import { extractLegalIds, legalPageCandidates } from "../src/sources/web.js";

describe("extractLegalIds", () => {
  it("trouve un SIREN dans des mentions légales françaises", () => {
    const text = "Alan Insurance, SA au capital de 203.000.000€ (Siren: 908 311 103 R.C.S. Paris)";
    expect(extractLegalIds(text).siren).toBe("908311103");
  });

  it("trouve un HRB et son tribunal dans un Impressum", () => {
    const text = "Avrea GmbH · Amtsgericht Charlottenburg · HRB 123456 B";
    expect(extractLegalIds(text, "Avrea")).toMatchObject({ hrb: "HRB 123456 (Amtsgericht Charlottenburg)", entity: "Avrea GmbH" });
  });

  it("trouve la raison sociale citée dans une politique de confidentialité", () => {
    expect(extractLegalIds("Avrea Ltd (later, Avrea or we) respects your privacy", "Avrea").entity).toBe("Avrea Ltd");
  });
});

describe("legalPageCandidates", () => {
  it("classe mentions légales avant confidentialité et ignore les autres domaines", () => {
    const md = "[Privacy](https://avrea.com/privacy) [Docs](https://docs.avrea.com/) [Impressum](https://avrea.com/impressum) [X](https://x.com/legal)";
    expect(legalPageCandidates(md, "avrea.com").slice(0, 2)).toEqual(["https://avrea.com/impressum", "https://avrea.com/privacy"]);
  });
});

describe("registryEvidence", () => {
  const record: CompanyRecord = {
    siren: "123456789",
    nom_complet: "EXEMPLE SAS",
    date_creation: "2023-03-01",
    tranche_effectif_salarie: "12",
    annee_tranche_effectif_salarie: "2024",
    categorie_entreprise: "PME",
    activite_principale: "62.01Z",
    etat_administratif: "A",
    siege: { adresse: "1 RUE X 75001 PARIS", libelle_commune: "PARIS" },
    dirigeants: [{ nom: "DUPONT", prenoms: "JEANNE", qualite: "Présidente", type_dirigeant: "personne physique" }],
    finances: { "2024": { ca: 1_200_000, resultat_net: -300_000 } },
  };

  it("produit un fait par information, avec dates", () => {
    const facts = registryEvidence(record);
    expect(facts.find((f) => f.claim.includes("20-49"))?.as_of).toBe("2024");
    expect(facts.find((f) => f.claim.startsWith("Comptes 2024"))?.value).toEqual({ ca: 1_200_000, resultat_net: -300_000 });
    expect(facts.some((f) => f.claim.includes("JEANNE DUPONT — Présidente"))).toBe(true);
  });

  it("ne garde aucune date de naissance des dirigeants", () => {
    const withBirth = { ...record, dirigeants: [{ ...record.dirigeants[0], date_de_naissance: "1980-01" } as never] };
    expect(JSON.stringify(registryEvidence(withBirth))).not.toContain("1980-01");
  });
});

describe("jobsEvidence", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("passe à l'ATS suivant quand le premier ne connaît pas la boîte", async () => {
    vi.stubGlobal("fetch", async (url: string) => {
      if (url.includes("ashbyhq")) return new Response("{}", { status: 404 });
      if (url.includes("greenhouse"))
        return Response.json({ jobs: [
          { title: "Backend Engineer", location: { name: "Paris" }, departments: [{ name: "Engineering" }] },
          { title: "Account Executive", location: { name: "Paris" }, departments: [{ name: "Sales" }] },
          { title: "SRE", location: { name: "Remote" }, departments: [{ name: "Engineering" }] },
        ] });
      throw new Error(`appel inattendu ${url}`);
    });
    const facts = await jobsEvidence("exemple");
    expect(facts[0].claim).toBe("3 offres d'emploi ouvertes sur greenhouse");
    expect(facts[1].value).toEqual({ Engineering: 2, Sales: 1 });
  });
});
