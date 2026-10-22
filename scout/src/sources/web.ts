// Le site de la boîte (lu via Jina Reader, qui rend la page en Markdown, JS compris)
// et son historique dans la Wayback Machine.
import type { EvidenceInput } from "../evidence.js";
import { getJson, getText } from "./http.js";

/** Lit une page et la rend en texte (Markdown si possible). Non tronquée. */
export async function readPage(url: string): Promise<string> {
  const headers: Record<string, string> = { accept: "text/plain", "x-return-format": "markdown" };
  if (process.env.JINA_API_KEY) headers.authorization = `Bearer ${process.env.JINA_API_KEY}`;
  try {
    return await getText(`https://r.jina.ai/${url}`, { headers }, 45_000);
  } catch {
    // Repli : HTML brut débarrassé des balises (sans rendu JavaScript).
    const html = await getText(url, { headers: { accept: "text/html" } });
    return html
      .replace(/<(script|style|svg|noscript)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ");
  }
}

const LINK = /\]\((https?:\/\/[^)\s]+)\)/g;
// Par ordre de chance d'y trouver l'identité légale.
const LEGAL_PATTERNS = [/mentions|imprint|impressum|legal/i, /privac|confidentialit|datenschutz/i, /terms|cgu|cgv/i];
const GUESSED_PATHS = ["/mentions-legales", "/fr/mentions-legales", "/fr-fr/mentions-legales", "/impressum", "/imprint", "/legal"];

/** Pages susceptibles d'afficher SIREN / HRB : liens du site d'abord, chemins usuels ensuite. */
export function legalPageCandidates(markdown: string, domain: string, max = 4): string[] {
  const links = [...new Set([...markdown.matchAll(LINK)].map((m) => m[1].split("#")[0]))].filter((l) => {
    try {
      return new URL(l).hostname.replace(/^www\./, "") === domain;
    } catch {
      return false;
    }
  });
  const ranked = LEGAL_PATTERNS.flatMap((re) => links.filter((l) => re.test(new URL(l).pathname)));
  const guessed = GUESSED_PATHS.map((p) => `https://${domain}${p}`);
  return [...new Set([...ranked, ...guessed])].slice(0, max);
}

export interface LegalIds {
  entity?: string; // raison sociale affichée, ex. « Avrea Ltd »
  siren?: string;
  hrb?: string; // Handelsregister (DE)
  companyNumber?: string; // Companies House (UK)
}

/** Extrait les identifiants légaux qu'une boîte est obligée d'afficher sur son site. */
export function extractLegalIds(text: string, brand?: string): LegalIds {
  const ids: LegalIds = {};
  if (brand) {
    const forms = "Ltd|Limited|GmbH|SAS|SASU|SARL|SA|Inc|BV|B\\.V\\.|AB|Oy|SL|S\\.L\\.|SpA|AG|SE|ApS|AS";
    const entity = text.match(new RegExp(`\\b(${escapeRegExp(brand)}(?:\\s[A-Z][\\w&-]+){0,2})\\s(${forms})\\b\\.?`, "i"));
    if (entity) ids.entity = `${entity[1]} ${entity[2]}`;
  }
  const siren = text.match(/(?:SIREN|RCS|R\.C\.S\.?)[^0-9]{0,40}(\d{3}\s?\d{3}\s?\d{3})(?!\s?\d)/i)
    ?? text.match(/(\d{3}\s?\d{3}\s?\d{3})\s*R\.?C\.?S\.?/i);
  if (siren) ids.siren = siren[1].replace(/\s/g, "");
  const hrb = text.match(/\bHR\s?B\s?(\d{3,7})(?:\s?[A-Z])?/);
  if (hrb) {
    const court = text.match(/Amtsgericht\s+([A-ZÄÖÜ][\wäöüß-]+(?:\s[\wäöüß-]+)?)/);
    ids.hrb = `HRB ${hrb[1]}${court ? ` (Amtsgericht ${court[1]})` : ""}`;
  }
  const uk = text.match(/compan(?:y|ies)\s+(?:registration\s+)?(?:number|no\.?)\s*:?\s*([A-Z]{2}\d{6}|\d{8})/i);
  if (uk) ids.companyNumber = uk[1];
  return ids;
}

/** Ancienneté et activité du site : première capture, captures par an. */
export async function waybackEvidence(domain: string): Promise<EvidenceInput[]> {
  const rows = await getJson<string[][]>(
    `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(domain)}&output=json&fl=timestamp&collapse=timestamp:6&filter=statuscode:200`,
  );
  const months = rows.slice(1).map(([ts]) => ts);
  if (!months.length) return [];
  const byYear = new Map<string, number>();
  for (const ts of months) byYear.set(ts.slice(0, 4), (byYear.get(ts.slice(0, 4)) ?? 0) + 1);
  const first = months[0];
  const firstDate = `${first.slice(0, 4)}-${first.slice(4, 6)}`;
  return [
    {
      claim: `Première capture du site ${domain} dans la Wayback Machine : ${firstDate}`,
      value: firstDate,
      source: "Wayback Machine (CDX)",
      url: `https://web.archive.org/web/${first}/${domain}`,
      as_of: firstDate,
      authority: "donnee-publique",
      confidence: "observed",
      limitations: ["Un domaine peut avoir appartenu à une autre entité avant la boîte actuelle"],
    },
    {
      claim: `Mois avec au moins une capture, par année : ${[...byYear].map(([y, n]) => `${y}: ${n}`).join(", ")}`,
      value: Object.fromEntries(byYear),
      source: "Wayback Machine (CDX)",
      url: `https://web.archive.org/web/*/${domain}`,
      authority: "donnee-publique",
      confidence: "observed",
      limitations: ["Indicateur indirect de notoriété, pas de trafic"],
    },
  ];
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
