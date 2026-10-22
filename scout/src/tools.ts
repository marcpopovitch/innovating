// Les outils que les sous-agents peuvent appeler. Chaque outil de collecte écrit
// ses faits dans le registre et renvoie au modèle leurs ids, à citer ensuite.
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { Authority, Confidence, type EvidenceInput, type Ledger, PodReport, unknownCitations } from "./evidence.js";
import { bodaccEvidence, companiesHouseEvidence, companyBySiren, registryEvidence, searchCompanies } from "./sources/registry.js";
import { githubEvidence, jobsEvidence, openAlexEvidence } from "./sources/signals.js";
import { readPage, waybackEvidence } from "./sources/web.js";

const MAX_PAGE_CHARS = 25_000;

export interface PodContext {
  ledger: Ledger;
  seenUrls: Set<string>; // URLs réellement lues ou renvoyées par la recherche web
  recorded: string[]; // preuves enregistrées à la main par l'agent
  report?: PodReport;
  log: (msg: string) => void;
}

function listEvidence(ctx: PodContext, items: EvidenceInput[], empty: string): string {
  if (!items.length) return empty;
  return items
    .map((item) => ctx.ledger.add(item))
    .map((e) => `${e.id} | ${e.claim}${e.as_of ? ` (au ${e.as_of})` : ""}`)
    .join("\n");
}

export function makeTools(ctx: PodContext) {
  const collect = (name: string, description: string, inputSchema: z.ZodObject, fetcher: (input: any) => Promise<EvidenceInput[]>, empty: string) =>
    betaZodTool({
      name,
      description,
      inputSchema,
      run: async (input) => {
        ctx.log(`${name} ${JSON.stringify(input)}`);
        return listEvidence(ctx, await fetcher(input), empty);
      },
    });

  return [
    betaZodTool({
      name: "registry_search",
      description: "Cherche des sociétés françaises par nom dans le registre INSEE/RNE. Renvoie des candidats (SIREN, nom, ville, création, effectif) sans les enregistrer comme preuves : appelle ensuite registry_lookup sur le bon SIREN.",
      inputSchema: z.object({ query: z.string() }),
      run: async ({ query }) => {
        ctx.log(`registry_search "${query}"`);
        const results = await searchCompanies(query, 8);
        return results.map((r) => `${r.siren} | ${r.nom_complet} | ${r.siege.libelle_commune ?? "?"} | créée ${r.date_creation ?? "?"} | NAF ${r.activite_principale ?? "?"} | tranche ${r.tranche_effectif_salarie ?? "?"}`).join("\n") || "Aucun résultat.";
      },
    }),
    collect(
      "registry_lookup",
      "Fiche légale officielle d'une société française par SIREN : dénomination, siège, création, effectif, dirigeants, comptes publiés.",
      z.object({ siren: z.string() }),
      async ({ siren }) => {
        const record = await companyBySiren(siren);
        return record ? registryEvidence(record) : [];
      },
      "SIREN introuvable dans le registre.",
    ),
    collect("bodacc", "Annonces légales BODACC d'une société française (SIREN) : augmentations de capital, cessions, dépôts de comptes, procédures collectives.", z.object({ siren: z.string() }), ({ siren }) => bodaccEvidence(siren), "Aucune annonce BODACC."),
    collect("companies_house", "Registre britannique Companies House (si la clé est configurée).", z.object({ query: z.string() }), ({ query }) => companiesHouseEvidence(query), "Aucun résultat Companies House."),
    collect("wayback", "Historique du site dans la Wayback Machine : première capture et activité par année. Pour lire une ancienne version d'une page, utilise read_page sur https://web.archive.org/web/<AAAA>/<url>.", z.object({ domain: z.string() }), ({ domain }) => waybackEvidence(domain), "Aucune capture."),
    collect("jobs", "Offres d'emploi ouvertes via les pages carrières publiques (Ashby, Greenhouse, Lever, Workable). Le slug est en général le nom de la boîte en minuscules ; regarde aussi les liens de la page carrières.", z.object({ slug: z.string() }), ({ slug }) => jobsEvidence(slug), "Aucun ATS public trouvé pour ce slug."),
    collect("github", "Organisation GitHub publique : dépôts, étoiles, activité récente.", z.object({ org: z.string() }), ({ org }) => githubEvidence(org), "Organisation GitHub introuvable."),
    collect("openalex", "Publications scientifiques d'une personne (fondateurs deeptech).", z.object({ person: z.string() }), ({ person }) => openAlexEvidence(person), "Aucun auteur trouvé."),
    betaZodTool({
      name: "read_page",
      description: "Lit une page web (site de la boîte, page équipe, pricing, article de presse, archive Wayback) et renvoie son texte. Pour garder un fait, appelle ensuite record_evidence avec cette URL.",
      inputSchema: z.object({ url: z.string().url() }),
      run: async ({ url }) => {
        ctx.log(`read_page ${url}`);
        const text = await readPage(url);
        ctx.seenUrls.add(url);
        return text.length > MAX_PAGE_CHARS ? `${text.slice(0, MAX_PAGE_CHARS)}\n[… page tronquée]` : text;
      },
    }),
    betaZodTool({
      name: "record_evidence",
      description:
        "Enregistre un fait trouvé par recherche web ou lecture de page, ou un calcul dérivé d'autres preuves. Une URL réellement consultée est obligatoire pour un fait observé ; un calcul cite ses preuves sources dans derived_from. Renvoie l'id à citer.",
      inputSchema: z.object({
        claim: z.string().describe("Le fait en une phrase, avec chiffre et unité"),
        value: z.union([z.string(), z.number()]).optional(),
        url: z.string().url().optional(),
        source: z.string().describe("Nom lisible de la source, ex. « Sifted, 12/05/2026 »"),
        as_of: z.string().optional().describe("Date à laquelle le fait est vrai (AAAA-MM-JJ ou AAAA-MM)"),
        confidence: Confidence,
        authority: Authority,
        limitations: z.array(z.string()).optional(),
        derived_from: z.array(z.string()).optional(),
      }),
      run: async (input) => {
        if (input.confidence === "observed" && !input.url) throw new Error("Un fait observé doit avoir une URL.");
        if (input.confidence === "derived" && !input.derived_from?.length) throw new Error("Un fait dérivé doit citer ses preuves dans derived_from.");
        const evidence = ctx.ledger.add(input);
        ctx.recorded.push(evidence.id);
        return `${evidence.id} enregistré.`;
      },
    }),
    betaZodTool({
      name: "submit_report",
      description: "Rend le rapport final du pod. Chaque métrique cite au moins un id de preuve existant. À appeler une seule fois, en dernier.",
      inputSchema: PodReport,
      run: async (report) => {
        const missing = unknownCitations(report, ctx.ledger);
        if (missing.length) throw new Error(`Ids de preuve inconnus : ${missing.join(", ")}. Corrige les citations et renvoie le rapport.`);
        ctx.report = report;
        return "Rapport accepté. Termine maintenant, sans autre texte.";
      },
    }),
  ];
}
