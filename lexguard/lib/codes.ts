// Pyramide des normes ingérée par Ciceron, du sommet à la base.
export type Niveau = "constitutionnel" | "international" | "code" | "jurisprudence";

// Niveau 1 — bloc de constitutionnalité (textes non codifiés du dump LEGI).
export const CONSTITUTION: Record<string, string> = {
  JORFTEXT000000571356: "Constitution du 4 octobre 1958",
  JORFTEXT000000697056: "Déclaration des droits de l'homme et du citoyen de 1789",
  JORFTEXT000000868390: "Préambule de la Constitution du 27 octobre 1946",
  JORFTEXT000000790249: "Charte de l'environnement",
};

// Niveau 2 — codes utiles aux collectivités.
export const CODES: Record<string, string> = {
  LEGITEXT000006070633: "Code général des collectivités territoriales",
  LEGITEXT000006071367: "Code rural et de la pêche maritime",
  LEGITEXT000006074228: "Code de la route",
  LEGITEXT000006072665: "Code de la santé publique",
  LEGITEXT000006074220: "Code de l'environnement",
  LEGITEXT000006074075: "Code de l'urbanisme",
  LEGITEXT000025503132: "Code de la sécurité intérieure",
  LEGITEXT000006070719: "Code pénal",
  LEGITEXT000031366350: "Code des relations entre le public et l'administration",
  LEGITEXT000006070933: "Code de justice administrative",
  LEGITEXT000006070667: "Code de la voirie routière",
  LEGITEXT000006070299: "Code général de la propriété des personnes publiques",
  LEGITEXT000006074096: "Code de la construction et de l'habitation",
  LEGITEXT000006070239: "Code électoral",
  LEGITEXT000025244092: "Code forestier (nouveau)",
};

export const ALL_TEXTS: Record<string, { title: string; niveau: Niveau }> = {
  ...Object.fromEntries(Object.entries(CONSTITUTION).map(([id, title]) => [id, { title, niveau: "constitutionnel" as const }])),
  ...Object.fromEntries(Object.entries(CODES).map(([id, title]) => [id, { title, niveau: "code" as const }])),
};
