// Contrat partagé entre les agents, l'API et l'interface.

export type Verdict = "conflit" | "doublon" | "vide" | "incompetence" | "conforme";
export type Severity = "critique" | "majeure" | "mineure" | "info";
export type AgentName = "orchestrateur" | "analyste" | "chercheur" | "juge" | "contradicteur" | "redacteur" | "veilleur" | "impact";

/** Une disposition normative extraite d'un acte (une règle = une ligne). */
export interface Disposition {
  id: string; // d1, d2…
  text: string; // extrait de l'acte
  objet: string; // ex. « interdiction d'épandage de pesticides »
  mesure: string; // ce que la règle impose ou interdit
  autorite: string; // qui l'édicte (maire, préfet…)
  perimetre?: string; // lieu, public, durée
  references: string[]; // textes cités par l'acte lui-même
}

export interface Citation {
  article_id: string; // LEGIARTI…
  num: string; // L2212-2
  code: string; // Code général des collectivités territoriales
  quote: string; // extrait mot pour mot
  url: string; // lien Légifrance (seule version qui fait foi)
}

export interface Finding {
  id: string;
  analysis_id: string;
  disposition: Disposition;
  verdict: Verdict;
  severity: Severity;
  title: string;
  explanation: string;
  citations: Citation[];
  suggestion: string | null;
  verified: boolean; // a passé le contradicteur + les contrôles en code
  rejection_reason: string | null;
}

export interface AnalysisSummary {
  headline: string;
  counts: Record<Verdict, number>;
  rejected: number; // alertes écartées par le contradicteur
  articles_consulted: number;
}

export interface Analysis {
  id: string;
  kind: "acte" | "jo";
  title: string;
  input: string;
  collectivite: string | null;
  date_acte: string | null;
  status: "en_cours" | "termine" | "erreur";
  summary: AnalysisSummary | null;
  cost_usd: number | null;
  latency_ms: number | null;
  created_at: string;
}

/** Événement du flux SSE GET /api/analyses/[id]/stream (une ligne `data:` JSON par événement). */
export interface AgentEvent {
  id: number;
  analysis_id: string;
  ts: string;
  agent: AgentName;
  type: "etape" | "outil" | "resultat" | "rejet" | "erreur" | "fin";
  message: string;
  data?: unknown;
}

/** GET /api/stats — compteurs de la couche de données. */
export interface Stats {
  articles: number;
  articles_en_vigueur: number;
  codes: Array<{ code_id: string; code_title: string; articles: number }>;
  links: number;
  jo_texts: number;
  last_jo_date: string | null;
  local_acts: number;
  analyses: number;
  findings: number;
  feedback: number;
  recent_queries: Array<{ ts: string; actor: string; kind: string; detail: string; rows: number; ms: number }>;
}

/** GET /api/veille — textes du JO récents et alertes d'impact. */
export interface VeilleItem {
  id: string; // JORFTEXT
  nature: string | null;
  title: string;
  date_publi: string | null;
  url: string;
  modifies: string[];
  impacts: Array<{ collectivite: string; act_title: string; reason: string }>;
}

// API :
// POST /api/analyses  { title, input, collectivite?, date_acte? } → { id }
// GET  /api/analyses/[id] → { analysis: Analysis, findings: Finding[] }
// GET  /api/analyses/[id]/stream → SSE d'AgentEvent, se termine sur type "fin"
// POST /api/feedback  { finding_id, decision: "valide" | "rejete", reason? } → { ok: true }
// GET  /api/stats → Stats
// GET  /api/veille → { items: VeilleItem[] }
