// Source live UE : point SPARQL CELLAR d'EUR-Lex (public, sans clé).
// Complète le corpus DILA (droit interne) par le droit de l'Union : permet de
// repérer les actes récents (règlements, directives) à confronter aux normes
// françaises, puis d'en lire le texte via fetch_eu_act (par CELEX).
const ENDPOINT = "https://publications.europa.eu/webapi/rdf/sparql";

interface SparqlBinding {
  [variable: string]: { type: string; value: string; datatype?: string };
}
interface SparqlResponse {
  head: { vars: string[] };
  results: { bindings: SparqlBinding[] };
}

/** Exécute une requête SPARQL et renvoie des lignes aplaties { var: value }. */
export async function sparql(query: string): Promise<Record<string, string>[]> {
  const url = `${ENDPOINT}?query=${encodeURIComponent(query)}&format=${encodeURIComponent("application/sparql-results+json")}`;
  const res = await fetch(url, {
    headers: { Accept: "application/sparql-results+json" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`EUR-Lex SPARQL ${res.status}`);
  const json = (await res.json()) as SparqlResponse;
  return (json.results?.bindings ?? []).map((b) => Object.fromEntries(Object.entries(b).map(([k, v]) => [k, v.value])));
}

export interface EuAct {
  work: string; // URI CELLAR de l'œuvre
  celex: string; // ex. 32009L0128
  date: string; // ISO (date du document)
}

/**
 * Actes juridiques de l'Union récents (avec identifiant CELEX), par date
 * décroissante. `since` au format YYYY-MM-DD. Requête validée sur le point
 * CELLAR public ; le texte intégral se lit ensuite avec fetch_eu_act(celex).
 */
export async function recentEuActs(since = "2025-01-01", limit = 15): Promise<EuAct[]> {
  const query = `PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>
SELECT ?work ?celex ?date WHERE {
  ?work cdm:resource_legal_id_celex ?celex .
  ?work cdm:work_date_document ?date .
  FILTER(?date >= "${since}"^^<http://www.w3.org/2001/XMLSchema#date>)
} ORDER BY DESC(?date) LIMIT ${limit}`;
  const rows = await sparql(query);
  return rows.map((r) => ({ work: r.work, celex: r.celex, date: r.date }));
}
