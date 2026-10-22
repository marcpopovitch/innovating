// Contrôles en code, indépendants du modèle : une citation doit exister, être en
// vigueur à la date de l'acte et contenir mot pour mot l'extrait cité.

export interface ArticleRow {
  id: string;
  num: string | null;
  code_title: string;
  text: string;
  etat: string;
  date_debut: string | Date | null;
  date_fin: string | Date | null;
}

export const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[«»"“”'’`]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase();

const toDate = (d: string | Date | null) => (d == null ? null : new Date(d));

/** Renvoie la liste des problèmes (vide = citation valide). */
export function checkCitation(article: ArticleRow | undefined, quote: string, dateActe: string | null): string[] {
  if (!article) return ["article introuvable dans le corpus"];
  const problems: string[] = [];
  const q = normalize(quote);
  if (q.length < 12) problems.push("extrait trop court pour être vérifié");
  else if (!normalize(article.text).includes(q)) problems.push(`l'extrait cité ne figure pas dans l'article ${article.num ?? article.id}`);
  const at = dateActe ? new Date(dateActe) : new Date();
  const debut = toDate(article.date_debut);
  const fin = toDate(article.date_fin);
  const inForce = (!debut || debut <= at) && (!fin || fin > at);
  if (!inForce) problems.push(`l'article ${article.num ?? article.id} n'est pas en vigueur au ${at.toISOString().slice(0, 10)} (état ${article.etat})`);
  return problems;
}
