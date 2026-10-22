// Registres légaux. France : API Recherche d'entreprises (INSEE + RNE/INPI,
// gratuite, sans clé) et BODACC (annonces légales). Royaume-Uni : Companies House
// (gratuite, clé requise).
import type { EvidenceInput } from "../evidence.js";
import { getJson } from "./http.js";

const RECHERCHE = "https://recherche-entreprises.api.gouv.fr/search";
const BODACC =
  "https://bodacc-datadila.opendatasoft.com/api/explore/v2.1/catalog/datasets/annonces-commerciales/records";

// Tranches d'effectif INSEE
const TRANCHES: Record<string, string> = {
  "00": "0 salarié", "01": "1-2", "02": "3-5", "03": "6-9", "11": "10-19", "12": "20-49",
  "21": "50-99", "22": "100-199", "31": "200-249", "32": "250-499", "41": "500-999",
  "42": "1 000-1 999", "51": "2 000-4 999", "52": "5 000-9 999", "53": "10 000+",
};

interface Dirigeant {
  nom?: string;
  prenoms?: string;
  denomination?: string;
  qualite?: string;
  type_dirigeant: string;
}

export interface CompanyRecord {
  siren: string;
  nom_complet: string;
  date_creation: string | null;
  tranche_effectif_salarie: string | null;
  annee_tranche_effectif_salarie: string | null;
  categorie_entreprise: string | null;
  activite_principale: string | null;
  etat_administratif: string;
  siege: { adresse: string; libelle_commune: string | null };
  dirigeants: Dirigeant[];
  finances: Record<string, { ca: number | null; resultat_net: number | null }> | null;
}

export async function searchCompanies(query: string, limit = 5): Promise<CompanyRecord[]> {
  const url = `${RECHERCHE}?q=${encodeURIComponent(query)}&per_page=${limit}`;
  const { results } = await getJson<{ results: CompanyRecord[] }>(url);
  return results;
}

export async function companyBySiren(siren: string): Promise<CompanyRecord | null> {
  const clean = siren.replace(/\s/g, "");
  return (await searchCompanies(clean, 1)).find((r) => r.siren === clean) ?? null;
}

/** Transforme une fiche du registre en faits sourcés, un par information. */
export function registryEvidence(record: CompanyRecord): EvidenceInput[] {
  const url = `https://annuaire-entreprises.data.gouv.fr/entreprise/${record.siren}`;
  const base = {
    source: "API Recherche d'entreprises (INSEE / RNE)",
    url,
    authority: "registre-officiel" as const,
    confidence: "observed" as const,
  };
  const facts: EvidenceInput[] = [
    { ...base, claim: `Dénomination légale : ${record.nom_complet} (SIREN ${record.siren})`, value: { siren: record.siren, nom: record.nom_complet } },
    { ...base, claim: `Siège : ${record.siege.adresse}`, value: record.siege.adresse },
    { ...base, claim: `Statut : ${record.etat_administratif === "A" ? "active" : "cessée"}`, value: record.etat_administratif },
  ];
  if (record.date_creation) {
    facts.push({ ...base, claim: `Date de création : ${record.date_creation}`, value: record.date_creation, as_of: record.date_creation });
  }
  if (record.activite_principale) {
    facts.push({ ...base, claim: `Code NAF : ${record.activite_principale}`, value: record.activite_principale });
  }
  const tranche = record.tranche_effectif_salarie && TRANCHES[record.tranche_effectif_salarie];
  if (tranche) {
    facts.push({
      ...base,
      claim: `Effectif salarié déclaré (tranche INSEE) : ${tranche}`,
      value: tranche,
      as_of: record.annee_tranche_effectif_salarie ?? undefined,
      limitations: ["Tranche déclarative INSEE, souvent en retard d'un à deux ans sur la réalité"],
    });
  }
  for (const [year, f] of Object.entries(record.finances ?? {})) {
    facts.push({
      ...base,
      claim: `Comptes ${year} : CA ${fmtEur(f.ca)}, résultat net ${fmtEur(f.resultat_net)}`,
      value: { ca: f.ca, resultat_net: f.resultat_net },
      as_of: `${year}-12-31`,
    });
  }
  if (!record.finances) {
    facts.push({
      ...base,
      claim: "Aucun compte annuel publié dans le registre",
      value: null,
      confidence: "inferred",
      limitations: ["Beaucoup de jeunes sociétés déposent leurs comptes en confidentialité"],
    });
  }
  // Minimisation RGPD : nom et fonction seulement, pas de date de naissance.
  for (const d of record.dirigeants) {
    const who = d.type_dirigeant === "personne morale" ? d.denomination : `${d.prenoms ?? ""} ${d.nom ?? ""}`.trim();
    if (who) facts.push({ ...base, claim: `Dirigeant : ${who} — ${d.qualite ?? "fonction non précisée"}`, value: { nom: who, qualite: d.qualite } });
  }
  return facts;
}

interface BodaccRecord {
  dateparution: string;
  familleavis_lib: string;
  typeavis_lib: string;
  tribunal: string;
  url_complete: string;
  acte: string | null;
  jugement: string | null;
  modificationsgenerales: string | null;
  listepersonnes: string | null;
}

/** Annonces légales : créations, levées (augmentations de capital), cessions, procédures collectives. */
export async function bodaccEvidence(siren: string, limit = 20): Promise<EvidenceInput[]> {
  const where = encodeURIComponent(`registre="${siren.replace(/\s/g, "")}"`);
  const { results } = await getJson<{ results: BodaccRecord[] }>(
    `${BODACC}?where=${where}&order_by=dateparution%20desc&limit=${limit}`,
  );
  return results.map((r) => {
    const detail =
      parseJson(r.jugement)?.nature ??
      parseJson(r.modificationsgenerales)?.descriptif ??
      parseJson(r.acte)?.descriptif ??
      r.typeavis_lib;
    // Le capital social après l'opération : une augmentation trahit souvent une levée.
    const personne = parseJson(r.listepersonnes)?.personne as { capital?: { montantCapital?: string; devise?: string } } | undefined;
    const capital = personne?.capital?.montantCapital ? Number(personne.capital.montantCapital) : null;
    const capitalText = capital ? ` (capital social : ${fmtEur(capital)})` : "";
    return {
      claim: `BODACC ${r.dateparution} — ${r.familleavis_lib} : ${String(detail).slice(0, 240)}${capitalText}`,
      value: { famille: r.familleavis_lib, tribunal: r.tribunal, capital },
      source: "BODACC (DILA)",
      url: r.url_complete,
      as_of: r.dateparution,
      authority: "registre-officiel",
      confidence: "observed",
    } satisfies EvidenceInput;
  });
}

/** Companies House (UK). Clé gratuite : https://developer.company-information.service.gov.uk */
export async function companiesHouseEvidence(query: string): Promise<EvidenceInput[]> {
  const key = process.env.COMPANIES_HOUSE_API_KEY;
  if (!key) throw new Error("COMPANIES_HOUSE_API_KEY absente : connecteur UK inactif");
  const auth = { authorization: `Basic ${Buffer.from(`${key}:`).toString("base64")}` };
  const { items = [] } = await getJson<{ items?: Array<Record<string, string>> }>(
    `https://api.company-information.service.gov.uk/search/companies?q=${encodeURIComponent(query)}&items_per_page=3`,
    { headers: auth },
  );
  return items.map((c) => ({
    claim: `Companies House : ${c.title} (n° ${c.company_number}), statut ${c.company_status}, créée le ${c.date_of_creation}`,
    value: c,
    source: "Companies House",
    url: `https://find-and-update.company-information.service.gov.uk/company/${c.company_number}`,
    as_of: c.date_of_creation,
    authority: "registre-officiel",
    confidence: "observed",
  }));
}

function parseJson(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function fmtEur(n: number | null): string {
  return n == null ? "n.c." : `${new Intl.NumberFormat("fr-FR").format(n)} €`;
}
