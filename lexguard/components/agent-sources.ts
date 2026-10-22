// Les sources de droit qu'un message d'agent mentionne : sert au globe (arcs) et aux
// dossiers « sources consultées » pendant le travail des agents.

export type SourceId = "codes" | "constitution" | "ue" | "jurisprudence" | "jo" | "outremer";

export const SOURCES: Array<{ id: SourceId; label: string; pattern: RegExp }> = [
  { id: "codes", label: "Codes", pattern: /\bcodes?\b|légifrance|legiarti|\b[LRD]\.? ?\d{3,4}/i },
  { id: "constitution", label: "Constitution", pattern: /constitution|conseil constitutionnel|\bQPC\b/i },
  { id: "ue", label: "Droit européen", pattern: /\bUE\b|europ|directive|CJUE|eur-lex/i },
  { id: "jurisprudence", label: "Jurisprudence", pattern: /jurisprudence|conseil d.[ée]tat|cour administrative|\bCAA\b|cassation/i },
  { id: "jo", label: "Journal officiel", pattern: /journal officiel|\bJORF\b|\bJO\b|décret|arrêté ministériel/i },
  { id: "outremer", label: "Outre-mer", pattern: /outre-mer|guyane|réunion|mayotte|guadeloupe|martinique/i },
];

export function sourcesOf(message: string): SourceId[] {
  return SOURCES.filter((s) => s.pattern.test(message)).map((s) => s.id);
}
