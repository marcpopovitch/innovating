// Étape 0, sans LLM : à partir d'une URL ou d'un domaine, retrouver l'entité
// légale. Le site affiche ses identifiants (SIREN, HRB…) par obligation légale :
// c'est la jointure la plus fiable entre le web et les registres.
import type { Ledger } from "./evidence.js";
import { bodaccEvidence, companyBySiren, registryEvidence } from "./sources/registry.js";
import { extractLegalIds, legalPageCandidates, readPage, type LegalIds } from "./sources/web.js";

export interface Identity {
  input: string;
  domain: string;
  url: string;
  name: string;
  legalIds: LegalIds;
  legalName?: string;
  homepage: string; // Markdown de la page d'accueil, partagé avec les sous-agents
  evidenceIds: string[];
}

export function normalizeInput(input: string): { domain: string; url: string } {
  const withScheme = /^https?:\/\//.test(input) ? input : `https://${input}`;
  const url = new URL(withScheme);
  return { domain: url.hostname.replace(/^www\./, ""), url: url.toString() };
}

export async function resolveIdentity(input: string, ledger: Ledger, log: (msg: string) => void): Promise<Identity> {
  const { domain, url } = normalizeInput(input);
  log(`Lecture du site ${url}`);
  const homepage = await readPage(url).catch(() => "");
  const name = guessName(homepage, domain);

  let legalIds = extractLegalIds(homepage, name);
  for (const link of legalPageCandidates(homepage, domain)) {
    if (legalIds.siren || legalIds.hrb || legalIds.companyNumber || legalIds.entity) break;
    log(`Lecture des mentions légales ${link}`);
    legalIds = { ...legalIds, ...extractLegalIds(await readPage(link).catch(() => ""), name) };
  }

  const evidenceIds: string[] = [];
  const add = (...items: Parameters<Ledger["add"]>[0][]) => items.forEach((e) => evidenceIds.push(ledger.add(e).id));

  if (legalIds.entity) {
    add({ claim: `Entité juridique citée sur le site : ${legalIds.entity}`, value: legalIds.entity, source: "Mentions légales / politique de confidentialité", url, authority: "site-entreprise", confidence: "observed" });
  }
  if (legalIds.hrb) {
    add({
      claim: `Immatriculée au registre du commerce allemand : ${legalIds.hrb}`,
      value: legalIds.hrb,
      source: "Impressum du site",
      url,
      authority: "site-entreprise",
      confidence: "observed",
      limitations: ["Non recoupé avec le Handelsregister (accès payant via North Data)"],
    });
  }
  if (legalIds.companyNumber) {
    add({ claim: `Numéro Companies House affiché : ${legalIds.companyNumber}`, value: legalIds.companyNumber, source: "Mentions légales du site", url, authority: "site-entreprise", confidence: "observed" });
  }

  let legalName: string | undefined;
  if (legalIds.siren) {
    log(`SIREN ${legalIds.siren} trouvé → registres INSEE/RNE et BODACC`);
    const record = await companyBySiren(legalIds.siren).catch(() => null);
    if (record) {
      legalName = record.nom_complet;
      add(...registryEvidence(record));
      add(...(await bodaccEvidence(record.siren).catch(() => [])));
    }
  }
  return { input, domain, url, name, legalIds, legalName, homepage, evidenceIds };
}

/** Le segment du <title> qui contient le nom de domaine, sinon le domaine lui-même. */
function guessName(markdown: string, domain: string): string {
  const base = domain.split(".")[0];
  const title = markdown.match(/^Title:\s*(.+)$/m)?.[1] ?? "";
  const segment = title.split(/\s[|–—:-]\s/).map((s) => s.trim()).find((s) => s.toLowerCase().includes(base.toLowerCase()));
  return segment && segment.length <= 40 ? segment : base.charAt(0).toUpperCase() + base.slice(1);
}
