// Lecture des fichiers XML open data de la DILA (LEGI et JORF).
import { XMLParser } from "fast-xml-parser";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@",
  textNodeName: "#text",
  // Le contenu des articles est du HTML : on le garde brut pour le nettoyer nous-mêmes.
  stopNodes: ["*.CONTENU"],
  isArray: (name) => ["LIEN", "TITRE_TM", "LIEN_ART", "VERSION"].includes(name),
  parseTagValue: false,
});

export function htmlToText(html: unknown): string {
  if (typeof html !== "string") return "";
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h\d)>/gi, "\n")
    .replace(/<td[^>]*>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

const str = (v: unknown): string | null => {
  if (v == null) return null;
  if (typeof v === "string") return v.trim() || null;
  if (typeof v === "object" && "#text" in (v as object)) return String((v as { "#text": unknown })["#text"]).trim() || null;
  return null;
};
const date = (v: unknown): string | null => {
  const d = str(v);
  return d && !d.startsWith("2999") ? d : null; // 2999-01-01 = « pas de date » chez la DILA
};

export interface Lien {
  id: string;
  cidtexte: string | null;
  type: string;
  sens: string | null;
  nature: string | null;
  num: string | null;
  title: string;
}

function liens(node: unknown): Lien[] {
  const list = (node as { LIEN?: unknown[] } | undefined)?.LIEN ?? [];
  return list.map((l) => {
    const o = l as Record<string, unknown>;
    return {
      id: String(o["@id"]),
      cidtexte: str(o["@cidtexte"]),
      type: String(o["@typelien"] ?? "CITATION"),
      sens: str(o["@sens"]),
      nature: str(o["@naturetexte"]),
      num: str(o["@num"]),
      title: str(o["#text"]) ?? "",
    };
  });
}

export interface ParsedArticle {
  id: string;
  cid: string | null;
  num: string | null;
  etat: string;
  date_debut: string | null;
  date_fin: string | null;
  text_id: string; // LEGITEXT / JORFTEXT parent
  text_title: string;
  section: string | null;
  content: string;
  liens: Lien[];
}

export function parseArticle(xml: string): ParsedArticle | null {
  const root = parser.parse(xml).ARTICLE;
  if (!root) return null;
  const meta = root.META?.META_SPEC?.META_ARTICLE ?? {};
  const texte = root.CONTEXTE?.TEXTE ?? {};
  const titres: string[] = [];
  // Les sections sont imbriquées : TM > TITRE_TM + TM > …
  let tm = texte.TM;
  while (tm) {
    for (const t of tm.TITRE_TM ?? []) titres.push(str(t) ?? "");
    tm = tm.TM;
  }
  const titreTxt = Array.isArray(texte.TITRE_TXT) ? texte.TITRE_TXT.at(-1) : texte.TITRE_TXT;
  return {
    id: String(root.META.META_COMMUN.ID),
    cid: str(texte["@cid"]),
    num: str(meta.NUM),
    etat: str(meta.ETAT) ?? "VIGUEUR",
    date_debut: date(meta.DATE_DEBUT),
    date_fin: date(meta.DATE_FIN),
    text_id: str(texte["@cid"]) ?? "",
    text_title: str(titreTxt?.["@c_titre_court"]) ?? str(titreTxt) ?? "",
    section: titres.filter(Boolean).join(" > ") || null,
    content: htmlToText(root.BLOC_TEXTUEL?.CONTENU),
    liens: liens(root.LIENS),
  };
}

export interface ParsedTexte {
  id: string;
  nature: string | null;
  title: string;
  nor: string | null;
  date_publi: string | null;
  visas: string;
  liens: Lien[];
}

export function parseTexteVersion(xml: string): ParsedTexte | null {
  const root = parser.parse(xml).TEXTE_VERSION;
  if (!root) return null;
  const chron = root.META?.META_SPEC?.META_TEXTE_CHRONICLE ?? {};
  const version = root.META?.META_SPEC?.META_TEXTE_VERSION ?? {};
  return {
    id: String(root.META.META_COMMUN.ID),
    nature: str(root.META.META_COMMUN.NATURE),
    title: str(version.TITREFULL) ?? str(version.TITRE) ?? "",
    nor: str(chron.NOR),
    date_publi: date(chron.DATE_PUBLI),
    visas: htmlToText(root.VISAS?.CONTENU),
    liens: liens(version.LIENS),
  };
}

/** Ligne du corpus pour les textes hors LEGI (international, jurisprudence). */
export interface CorpusRow {
  id: string;
  code_id: string;
  code_title: string;
  num: string;
  section: string | null;
  text: string;
  date_debut: string | null;
  niveau: "international" | "jurisprudence";
  url: string;
}

const tag = (xml: string, name: string) => xml.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`))?.[1]?.trim() ?? null;

/** Décision du Conseil d'État au format open data (opendata.justice-administrative.fr, fichiers DCE_*.xml). */
export function parseDecisionCE(xml: string): CorpusRow | null {
  const ecli = tag(xml, "Numero_ECLI");
  const numero = tag(xml, "Numero_Dossier");
  const date = tag(xml, "Date_Lecture");
  const text = htmlToText(tag(xml, "Texte_Integral"));
  if (!ecli || !numero || !date || text.length < 200) return null;
  return {
    id: ecli,
    code_id: "CE",
    code_title: "Conseil d'État",
    num: `n° ${numero} du ${date}`,
    section: [tag(xml, "Type_Decision"), tag(xml, "Solution"), tag(xml, "Formation_Jugement"), `publication ${tag(xml, "Code_Publication") ?? "?"}`].filter(Boolean).join(" · "),
    text: text.slice(0, 30_000),
    date_debut: date,
    niveau: "jurisprudence",
    url: `https://www.conseil-etat.fr/fr/arianeweb/CE/decision/${date}/${numero}`,
  };
}

export const legifranceArticleUrl =(id: string) => `https://www.legifrance.gouv.fr/codes/article_lc/${id}`;
export const legifranceJorfUrl = (id: string) => `https://www.legifrance.gouv.fr/jorf/id/${id}`;
