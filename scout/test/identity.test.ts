import { afterEach, describe, expect, it, vi } from "vitest";
import { Ledger } from "../src/evidence.js";
import { normalizeInput, resolveIdentity } from "../src/identity.js";

const record = (siren: string, nom: string, nature = "5599") => ({
  siren, nom_complet: nom, nature_juridique: nature, date_creation: "2016-02-01", tranche_effectif_salarie: "41", annee_tranche_effectif_salarie: "2024",
  categorie_entreprise: "ETI", activite_principale: "65.12Z", etat_administratif: "A", dirigeants: [], finances: null,
  siege: { adresse: "117 QUAI DE VALMY 75010 PARIS", libelle_commune: "PARIS", code_postal: "75010" },
});

describe("normalizeInput", () => {
  it("accepte un domaine nu ou une URL", () => {
    expect(normalizeInput("www.alan.com/fr")).toEqual({ domain: "alan.com", url: "https://www.alan.com/fr" });
  });
});

describe("resolveIdentity", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("remonte de la filiale dont le SIREN est affiché vers l'entité citée au même siège", async () => {
    vi.stubGlobal("fetch", async (input: string) => {
      const url = String(input);
      if (url.startsWith("https://r.jina.ai/"))
        return new Response("Title: Alan | Assurance santé\n\nAlan SA. Alan Insurance (Siren: 908 311 103 R.C.S. Paris)");
      if (url.includes("recherche-entreprises") && url.includes("q=908311103")) return Response.json({ results: [record("908311103", "ALAN INSURANCE")] });
      if (url.includes("recherche-entreprises") && url.includes("code_postal=75010"))
        return Response.json({ results: [
          { ...record("490294410", "ALAN", "5499"), siege: { adresse: "221 RUE LA FAYETTE 75010 PARIS", libelle_commune: "PARIS", code_postal: "75010" } },
          record("818353070", "ALAN"),
        ] });
      if (url.includes("bodacc")) return Response.json({ results: [] });
      throw new Error(`appel inattendu ${url}`);
    });
    const ledger = new Ledger();
    const identity = await resolveIdentity("alan.com", ledger, () => {});
    expect(identity).toMatchObject({ name: "Alan", legalName: "ALAN", legalIds: { siren: "818353070", entity: "Alan SA" } });
    const link = ledger.all().find((e) => e.claim.startsWith("Entité principale probable"));
    expect(link).toMatchObject({ confidence: "inferred", authority: "inference-analyste" });
    expect(link?.derived_from).toHaveLength(2);
  });
});
