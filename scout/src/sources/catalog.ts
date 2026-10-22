// Catalogue des sources : ce qui est branché dans le prototype, ce qui attend une
// clé du fonds (« bring your own key »), et ce qu'on évite volontairement.
export type SourceStatus = "active" | "byok" | "eviter";

export interface SourceInfo {
  name: string;
  pods: string;
  status: SourceStatus;
  env?: string; // variable qui active le connecteur
  note: string;
}

export const SOURCES: SourceInfo[] = [
  { name: "API Recherche d'entreprises (INSEE / RNE)", pods: "Snapshot, Team", status: "active", note: "Gratuit, sans clé. Identité, dirigeants, effectif, comptes publiés." },
  { name: "BODACC", pods: "Snapshot, Traction", status: "active", note: "Gratuit. Augmentations de capital (signal de levée), cessions, procédures." },
  { name: "Site de l'entreprise (Jina Reader)", pods: "Produit, ICP, Team", status: "active", env: "JINA_API_KEY", note: "Gratuit avec limite ; clé optionnelle pour plus de débit." },
  { name: "Mentions légales / Impressum", pods: "Snapshot", status: "active", note: "SIREN, HRB ou numéro UK affichés par obligation légale." },
  { name: "Wayback Machine (CDX)", pods: "Traction, Produit", status: "active", note: "Gratuit. Ancienneté du site, versions passées du pricing." },
  { name: "Offres d'emploi (Ashby, Greenhouse, Lever, Workable)", pods: "Traction, ICP", status: "active", note: "Endpoints publics. Rythme et nature des recrutements." },
  { name: "GitHub", pods: "Traction, Team", status: "active", env: "GITHUB_TOKEN", note: "Gratuit (60 req/h sans token, 5 000 avec)." },
  { name: "OpenAlex", pods: "Team", status: "active", env: "OPENALEX_API_KEY", note: "Gratuit. Publications des fondateurs (deeptech)." },
  { name: "Recherche web Claude", pods: "Tous", status: "active", note: "Presse, levées, concurrents. ~10 $ / 1 000 recherches." },
  { name: "Companies House", pods: "Snapshot (UK)", status: "byok", env: "COMPANIES_HOUSE_API_KEY", note: "Gratuit, clé à créer." },
  { name: "Pappers", pods: "Snapshot", status: "byok", env: "PAPPERS_API_KEY", note: "Payant. Même donnée que les API publiques, mieux packagée." },
  { name: "Harmonic", pods: "Snapshot, Traction, Team", status: "byok", env: "HARMONIC_API_KEY", note: "Clé du fonds. Headcount hebdo, trafic web, investisseurs." },
  { name: "Dealroom", pods: "Snapshot", status: "byok", env: "DEALROOM_API_KEY", note: "Clé du fonds. Meilleure couverture des levées européennes." },
  { name: "People Data Labs", pods: "Team", status: "byok", env: "PDL_API_KEY", note: "Parcours des fondateurs sans scraper LinkedIn." },
  { name: "EPO OPS (brevets)", pods: "Team, Produit", status: "byok", env: "EPO_OPS_KEY", note: "Gratuit jusqu'à 4 Go/semaine, inscription requise." },
  { name: "Scraping LinkedIn", pods: "Team", status: "eviter", note: "Interdit par les CGU ; Proxycurl fermé en juillet 2025 après action de LinkedIn." },
  { name: "pytrends / Google Trends non officiel", pods: "Traction", status: "eviter", note: "Cassé ; l'API officielle est en alpha sur candidature." },
];

export function sourceStatus(): Array<SourceInfo & { enabled: boolean }> {
  return SOURCES.map((s) => ({
    ...s,
    enabled: s.status === "active" || (s.status === "byok" && !!s.env && !!process.env[s.env]),
  }));
}
