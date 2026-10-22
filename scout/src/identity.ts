// Étape 0, sans LLM : à partir d'une URL ou d'un domaine, retrouver l'entité
// légale. Le site affiche ses identifiants (SIREN, HRB…) par obligation légale :
// c'est la jointure la plus fiable entre le web et les registres.
import type { Ledger } from "./evidence.js";
import { bodaccEvidence, type CompanyRecord, companyBySiren, registryEvidence, searchCompanies } from "./sources/registry.js";
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
  const entities = new Map<string, string>(legalIds.entity ? [[legalIds.entity, url]] : []); // entité → page où elle est citée
  for (const link of legalPageCandidates(homepage, domain)) {
    if (legalIds.siren || legalIds.hrb || legalIds.companyNumber) break;
    log(`Lecture des mentions légales ${link}`);
    const found = extractLegalIds(await readPage(link).catch(() => ""), name);
    if (found.entity && !entities.has(found.entity)) entities.set(found.entity, link);
    legalIds = { ...found, ...legalIds }; // la première mention trouvée l'emporte
  }

  const evidenceIds: string[] = [];
  const add = (...items: Parameters<Ledger["add"]>[0][]) => items.forEach((e) => evidenceIds.push(ledger.add(e).id));

  // Plusieurs raisons sociales (ex. « Avrea Ltd » et « Avrea Oy ») : on garde chacune, l'écart est un signal.
  let entityEvidence: string | undefined;
  for (const [entity, page] of entities) {
    const id = ledger.add({ claim: `Entité juridique citée sur le site : ${entity}`, value: entity, source: "Mentions légales / politique de confidentialité", url: page, authority: "site-entreprise", confidence: "observed" }).id;
    evidenceIds.push(id);
    if (entity === legalIds.entity) entityEvidence = id;
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
    let record = await companyBySiren(legalIds.siren).catch(() => null);
    if (record) {
      add(...registryEvidence(record));
      add(...(await bodaccEvidence(record.siren).catch(() => [])));
      // Le SIREN affiché est parfois celui d'une filiale (ex. l'assureur d'un groupe) :
      // si le site cite une autre entité au même siège, c'est probablement la société qui lève.
      const parent = legalIds.entity && entityEvidence ? await findSameAddressEntity(legalIds.entity, record) : null;
      if (parent && entityEvidence) {
        log(`« ${legalIds.entity} » = ${parent.nom_complet} (SIREN ${parent.siren}), même siège → entité principale probable`);
        add({
          claim: `Entité principale probable : ${parent.nom_complet} (SIREN ${parent.siren}), au même siège que ${record.nom_complet} dont le SIREN est affiché sur le site`,
          value: { principale: parent.siren, affichee: record.siren },
          source: "Rapprochement site × registre",
          confidence: "inferred",
          authority: "inference-analyste",
          derived_from: [entityEvidence, ledger.add(registryEvidence(record)[0]).id],
          limitations: ["Rapprochement par nom et adresse : le lien capitalistique n'est pas vérifié"],
        });
        add(...registryEvidence(parent));
        add(...(await bodaccEvidence(parent.siren).catch(() => [])));
        legalIds = { ...legalIds, siren: parent.siren };
        record = parent;
      }
      legalName = record.nom_complet;
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

const LEGAL_FORM = /\s+(Ltd|Limited|GmbH|SAS|SASU|SARL|SA|Inc|BV|B\.V\.|AB|Oy|SL|S\.L\.|SpA|AG|SE|ApS|AS)\.?$/i;
const normalize = (name: string) => name.replace(LEGAL_FORM, "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();

/** Société du registre dont le nom est exactement l'entité citée et qui partage le siège de `record`. */
async function findSameAddressEntity(entity: string, record: CompanyRecord): Promise<CompanyRecord | null> {
  const name = normalize(entity);
  if (normalize(record.nom_complet) === name || !record.siege.code_postal) return null;
  const candidates = await searchCompanies(name, 25, { code_postal: record.siege.code_postal }).catch(() => []);
  return candidates.find((c) => c.siren !== record.siren && normalize(c.nom_complet) === name && c.siege.adresse === record.siege.adresse) ?? null;
}
