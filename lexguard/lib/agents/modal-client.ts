// Client serveur vers le service d'agents Python déployé sur Modal (voir agents/modal_app.py).
// Le service renvoie le format de agents/orchestrator.py, DIFFÉRENT du moteur TS in-process.
// Appelé uniquement côté serveur (route /api/analyses/modal) : MODAL_AGENTS_URL ne fuit pas au client.

export interface ModalCitation {
  ref: string;
  version_date: string | null;
  url: string | null;
  excerpt: string;
}

export interface ModalFinding {
  obligation: string;
  type: "conflit" | "doublon" | "vide" | "compatible";
  explanation: string;
  citations: ModalCitation[];
  confidence: number;
}

export interface ModalStep {
  agent: string;
  action: string;
  ms: number;
}

export interface ModalCheckResult {
  findings: ModalFinding[];
  summary: string;
  steps: ModalStep[];
  rejected_citations: number;
}

/** MODAL_AGENTS_URL absente : le service n'est pas (encore) déployé/configuré. */
export class ModalNotConfiguredError extends Error {}

/** Appelle POST {MODAL_AGENTS_URL}/check avec le texte de l'acte et renvoie le résultat des agents. */
export async function callModalCheck(draftText: string): Promise<ModalCheckResult> {
  const base = process.env.MODAL_AGENTS_URL;
  if (!base) throw new ModalNotConfiguredError("MODAL_AGENTS_URL n'est pas configurée côté serveur.");

  const res = await fetch(`${base.replace(/\/$/, "")}/check`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ draft_text: draftText }),
    // /check est synchrone (CHECK_TIMEOUT_S ~ 60-90 s côté Python) ; marge pour le cold start Modal.
    signal: AbortSignal.timeout(180_000),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Service Modal (${res.status})${detail ? ` : ${detail.slice(0, 300)}` : ""}`);
  }
  return (await res.json()) as ModalCheckResult;
}

// --- Audit du Journal Officiel par date/période (endpoint POST /jo-audit) ---

export interface JoAuditText {
  id: string;
  nature: string;
  title: string;
  url: string;
  findings: ModalFinding[];
  summary: string;
  rejected_citations: number;
}

export interface JoAuditResult {
  dates: string[];
  texts_count: number;
  counts: Record<string, number>;
  rejected_citations: number;
  texts: JoAuditText[];
}

export interface JoAuditParams {
  date?: string;
  date_from?: string;
  date_to?: string;
  max_texts?: number;
}

/** Audit de conformité du JO (une date ou une période) via le service Modal. */
export async function callModalJoAudit(params: JoAuditParams): Promise<JoAuditResult> {
  const base = process.env.MODAL_AGENTS_URL;
  if (!base) throw new ModalNotConfiguredError("MODAL_AGENTS_URL n'est pas configurée côté serveur.");

  const res = await fetch(`${base.replace(/\/$/, "")}/jo-audit`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(params),
    signal: AbortSignal.timeout(600_000), // un audit enchaîne plusieurs analyses
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Service Modal (${res.status})${detail ? ` : ${detail.slice(0, 300)}` : ""}`);
  }
  return (await res.json()) as JoAuditResult;
}
