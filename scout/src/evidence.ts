// Modèle de preuve, inspiré de morluto/rea (src/domain/evidence.ts) :
// chaque fait a un identifiant dérivé de son contenu, une autorité, un niveau
// de confiance et ses limites — plus les dates qui manquent à REA.
import { createHash } from "node:crypto";
import { z } from "zod";

export const Confidence = z.enum(["observed", "derived", "inferred"]);
export const Authority = z.enum([
  "registre-officiel", // INSEE, INPI, BODACC, Companies House…
  "site-entreprise", // ce que la boîte dit d'elle-même
  "donnee-publique", // GitHub, ATS, Wayback, OpenAlex
  "web", // presse, blogs, bases tierces trouvées par recherche
  "inference-analyste", // calcul ou déduction de l'agent
]);

export const EvidenceInput = z.object({
  claim: z.string().min(1), // le fait, en une phrase
  value: z.unknown().optional(), // la valeur brute (nombre, date, objet)
  source: z.string().min(1), // nom lisible de la source
  url: z.string().url().optional(),
  as_of: z.string().optional(), // date à laquelle le fait est vrai
  confidence: Confidence,
  authority: Authority,
  limitations: z.array(z.string()).default([]),
  derived_from: z.array(z.string()).default([]), // ids des preuves sources
});
export type EvidenceInput = z.input<typeof EvidenceInput>;

export const Evidence = EvidenceInput.extend({
  id: z.string().regex(/^ev_[0-9a-f]{12}$/),
  retrieved_at: z.string(),
});
export type Evidence = z.infer<typeof Evidence>;

/** Sérialisation stable : clés triées, pour que le même fait donne le même id. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function evidenceId(input: EvidenceInput): string {
  const { claim, value, source, url, as_of } = EvidenceInput.parse(input);
  const digest = createHash("sha256").update(canonical({ claim, value, source, url, as_of })).digest("hex");
  return `ev_${digest.slice(0, 12)}`;
}

/** Registre des preuves d'une analyse, partagé par tous les sous-agents. */
export class Ledger {
  readonly #items = new Map<string, Evidence>();

  add(input: EvidenceInput, retrievedAt = new Date().toISOString()): Evidence {
    const parsed = EvidenceInput.parse(input);
    const id = evidenceId(parsed);
    const existing = this.#items.get(id);
    if (existing) return existing; // même fait déjà collecté : idempotent
    const missing = parsed.derived_from.filter((ref) => !this.#items.has(ref));
    if (missing.length) throw new Error(`Preuves sources inconnues : ${missing.join(", ")}`);
    const evidence = Evidence.parse({ ...parsed, id, retrieved_at: retrievedAt });
    this.#items.set(id, evidence);
    return evidence;
  }

  get(id: string): Evidence | undefined {
    return this.#items.get(id);
  }

  has(id: string): boolean {
    return this.#items.has(id);
  }

  /** Ajoute une limite a posteriori (ex. URL jamais vue par l'agent). */
  flag(id: string, limitation: string): void {
    const evidence = this.#items.get(id);
    if (evidence && !evidence.limitations.includes(limitation)) evidence.limitations.push(limitation);
  }

  all(): Evidence[] {
    return [...this.#items.values()];
  }
}

// ---- Résultat d'un pod : toute affirmation doit citer au moins une preuve ----

export const PODS = ["snapshot", "traction", "team", "market", "product", "icp"] as const;
export type Pod = (typeof PODS)[number];

export const Metric = z.object({
  label: z.string(),
  value: z.string(),
  evidence_ids: z.array(z.string()).min(1, "chaque chiffre doit citer au moins une preuve"),
});

export const PodReport = z.object({
  summary: z.string(),
  metrics: z.array(Metric),
  unknowns: z.array(z.string()).default([]), // ce qu'on n'a pas pu établir
});
export type PodReport = z.infer<typeof PodReport>;

/** Renvoie les ids cités qui n'existent pas dans le registre. */
export function unknownCitations(report: PodReport, ledger: Ledger): string[] {
  return report.metrics.flatMap((m) => m.evidence_ids).filter((id) => !ledger.has(id));
}
