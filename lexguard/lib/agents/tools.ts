// Les outils des agents chercheurs : tout passe par la base (corpus DILA, JO, actes
// locaux) ou par EUR-Lex. Chaque requête est tracée dans query_log.
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { tracedQuery } from "../db";
import { htmlToText, legifranceArticleUrl } from "../dila";

export interface ArticleHit {
  id: string;
  niveau?: string;
  code_title: string;
  num: string | null;
  etat: string;
  section: string | null;
  snippet: string;
}

export type NiveauFiltre = "constitutionnel" | "international" | "code" | "jurisprudence";

export async function searchCorpus(actor: string, query: string, code?: string, limit = 8, since?: string, niveaux: NiveauFiltre[] = ["constitutionnel", "international", "code"]): Promise<ArticleHit[]> {
  return tracedQuery<ArticleHit>(
    actor,
    "recherche plein texte",
    `${niveaux.join("+")} « ${query} »${code ? ` dans ${code}` : ""}${since ? ` depuis ${since}` : ""}`,
    `select id, niveau, code_title, num, etat, section,
            ts_headline('french', text, q, 'MaxWords=45, MinWords=20, StartSel=«, StopSel=»') as snippet
       from articles, websearch_to_tsquery('french', $1) q
      where tsv @@ q and etat = 'VIGUEUR' and ($2::text is null or code_title ilike '%' || $2 || '%')
        and ($4::date is null or date_debut >= $4::date) and niveau = any($5)
      order by ts_rank_cd(tsv, q) desc
      limit $3`,
    [query, code ?? null, limit, since ?? null, niveaux],
  );
}

export interface FullArticle {
  id: string;
  niveau: string;
  url: string | null;
  cid: string | null;
  code_title: string;
  num: string | null;
  section: string | null;
  text: string;
  etat: string;
  date_debut: string | null;
  date_fin: string | null;
}

export async function getArticles(actor: string, ids: string[]): Promise<FullArticle[]> {
  if (!ids.length) return [];
  return tracedQuery<FullArticle>(
    actor,
    "lecture article",
    ids.join(", "),
    `select id, niveau, url, cid, code_title, num, section, text, etat, date_debut::text, date_fin::text from articles where id = any($1)`,
    [ids],
  );
}

/** Trouve la version en vigueur d'un article par son numéro (ex. « L2212-2 »). */
export async function findByNum(actor: string, num: string, code?: string): Promise<FullArticle[]> {
  const clean = num.replace(/^(art(icle)?\.?\s*)/i, "").replace(/\s+/g, "").replace(/\.$/, "");
  return tracedQuery<FullArticle>(
    actor,
    "lecture article",
    `numéro ${clean}${code ? ` (${code})` : ""}`,
    `select id, niveau, url, cid, code_title, num, section, text, etat, date_debut::text, date_fin::text
       from articles
      where replace(replace(num, ' ', ''), '.', '') = replace($1, '.', '') and etat = 'VIGUEUR'
        and ($2::text is null or code_title ilike '%' || $2 || '%')
      limit 3`,
    [clean, code ?? null],
  );
}

export interface ResearchState {
  candidates: Map<string, string>; // article → pourquoi
  consulted: Set<string>;
  assign?: Map<string, string[]>; // article → dispositions concernées (agents de niveau)
}

export const sourceUrl = (a: { id: string; url?: string | null }) => a.url ?? legifranceArticleUrl(a.id);

export function makeResearchTools(actor: string, state: ResearchState, niveauxParDefaut: NiveauFiltre[] = ["constitutionnel", "international", "code"]) {
  const fmtHits = (hits: ArticleHit[]) =>
    hits.length ? hits.map((h) => `${h.id} | [${h.niveau ?? "code"}] ${h.code_title} ${h.num ?? "?"} | ${h.section ?? ""}\n   ${h.snippet.replace(/\s+/g, " ")}`).join("\n") : "Aucun article en vigueur ne correspond. Reformule (synonymes juridiques, termes plus généraux).";

  return [
    betaZodTool({
      name: "search_corpus",
      description: "Recherche plein texte (français, opérateurs websearch : guillemets, OR, -) dans les textes EN VIGUEUR de la pyramide des normes : bloc de constitutionnalité (Constitution, DDHC, Préambule de 1946, Charte de l'environnement), international/UE (CEDH, Charte des droits fondamentaux de l'UE, directive Services) et 15 codes (CGCT, CRPA, justice administrative, route, voirie routière, CGPPP, sécurité intérieure, santé publique, environnement, construction et habitation, rural, électoral, urbanisme, forestier, pénal). Filtres optionnels : `code` (sous-chaîne du nom du code) et `since` (AAAA-MM-JJ : seulement les versions entrées en vigueur depuis cette date, pour voir ce qui a changé).",
      inputSchema: z.object({
        query: z.string(),
        code: z.string().optional(),
        since: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        niveau: z.enum(["constitutionnel", "international", "code"]).optional().describe("Restreindre à un niveau de la pyramide des normes"),
      }),
      run: async ({ query, code, since, niveau }) => {
        const hits = await searchCorpus(actor, query, code, 8, since, niveau ? [niveau] : niveauxParDefaut);
        hits.forEach((h) => state.consulted.add(h.id));
        return fmtHits(hits);
      },
    }),
    betaZodTool({
      name: "get_article",
      description: "Texte intégral d'un article, par identifiant LEGIARTI ou par numéro (ex. « L2212-2 », avec le code si ambigu). Donne l'état, les dates de vigueur et la section.",
      inputSchema: z.object({ id: z.string().optional(), num: z.string().optional(), code: z.string().optional() }),
      run: async ({ id, num, code }) => {
        const rows = id ? await getArticles(actor, [id]) : num ? await findByNum(actor, num, code) : [];
        if (!rows.length) return "Article introuvable (vérifie le numéro, ou cherche avec search_corpus).";
        return rows
          .map((a) => {
            state.consulted.add(a.id);
            return `${a.id} | [${a.niveau}] ${a.code_title} ${a.num} | ${a.etat} du ${a.date_debut ?? "?"} au ${a.date_fin ?? "…"}\nSection : ${a.section ?? "—"}\n${a.text.slice(0, a.niveau === "jurisprudence" ? 9000 : 6000)}`;
          })
          .join("\n\n---\n\n");
      },
    }),
    betaZodTool({
      name: "follow_links",
      description: "Graphe des normes : articles et textes liés à un article (ce qu'il cite, ce qui le cite, ce qui l'a modifié). Utile pour remonter à la règle de compétence ou aux textes d'application.",
      inputSchema: z.object({ id: z.string() }),
      run: async ({ id }) => {
        const rows = await tracedQuery<{ other: string; type: string; sens: string | null; title: string | null; num: string | null; code_title: string | null }>(
          actor,
          "graphe des normes",
          `liens de ${id}`,
          `select l.dst as other, l.type, l.sens, l.dst_title as title, a.num, a.code_title
             from links l left join articles a on a.id = l.dst and a.etat = 'VIGUEUR' where l.src = $1
           union all
           select l.src as other, l.type, 'cité par' as sens, a.num as title, a.num, a.code_title
             from links l join articles a on a.id = l.src and a.etat = 'VIGUEUR' where l.dst = $1
           limit 40`,
          [id],
        );
        return rows.length ? rows.map((r) => `${r.other} | ${r.type} (${r.sens ?? ""}) | ${r.code_title ? `${r.code_title} art. ${r.num}` : r.title ?? ""}`).join("\n") : "Aucun lien déclaré.";
      },
    }),
    betaZodTool({
      name: "search_jurisprudence",
      description: "Recherche plein texte dans les décisions du Conseil d'État (open data, depuis septembre 2021) : annulations d'arrêtés municipaux, interprétation des pouvoirs de police, etc. Renvoie l'identifiant ECLI à lire avec get_article.",
      inputSchema: z.object({ query: z.string(), since: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }),
      run: async ({ query, since }) => {
        const hits = await searchCorpus(actor, query, undefined, 6, since, ["jurisprudence"]);
        hits.forEach((h) => state.consulted.add(h.id));
        return fmtHits(hits);
      },
    }),
    betaZodTool({
      name: "search_jo",
      description: "Recherche dans les textes récemment parus au Journal officiel (flux quotidien DILA).",
      inputSchema: z.object({ query: z.string() }),
      run: async ({ query }) => {
        const rows = await tracedQuery<{ id: string; nature: string; title: string; date_publi: string }>(
          actor,
          "recherche JO",
          `JO « ${query} »`,
          `select id, nature, title, date_publi::text from jo_texts, websearch_to_tsquery('french', $1) q where tsv @@ q order by date_publi desc nulls last limit 6`,
          [query],
        );
        return rows.length ? rows.map((r) => `${r.id} | ${r.nature} | ${r.date_publi} | ${r.title}`).join("\n") : "Aucun texte récent du JO.";
      },
    }),
    betaZodTool({
      name: "search_local_acts",
      description: "Recherche dans les actes déjà adoptés par les collectivités (délibérations, arrêtés) : utile pour repérer un DOUBLON ou une contradiction avec un acte local existant.",
      inputSchema: z.object({ query: z.string(), collectivite: z.string().optional() }),
      run: async ({ query, collectivite }) => {
        const rows = await tracedQuery<{ id: number; collectivite: string; title: string; date_acte: string | null; url: string | null }>(
          actor,
          "recherche actes locaux",
          `actes « ${query} »${collectivite ? ` (${collectivite})` : ""}`,
          `select id, collectivite, title, date_acte::text, url from local_acts, websearch_to_tsquery('french', $1) q
            where tsv @@ q and ($2::text is null or collectivite ilike '%' || $2 || '%')
            order by ts_rank_cd(tsv, q) desc limit 6`,
          [query, collectivite ?? null],
        );
        return rows.length ? rows.map((r) => `acte#${r.id} | ${r.collectivite} | ${r.date_acte ?? "?"} | ${r.title}${r.url ? ` | ${r.url}` : ""}`).join("\n") : "Aucun acte local correspondant.";
      },
    }),
    betaZodTool({
      name: "fetch_eu_act",
      description: "Lit un acte de l'Union européenne sur EUR-Lex par son numéro CELEX (ex. 32009L0128 pour la directive pesticides). Renvoie le début du texte.",
      inputSchema: z.object({ celex: z.string().regex(/^[0-9A-Z]{6,}$/) }),
      run: async ({ celex }) => {
        // EUR-Lex bloque les lectures automatiques : on passe par CELLAR (Office des publications).
        const url = `http://publications.europa.eu/resource/celex/${celex}`;
        const t0 = Date.now();
        const html = await (await fetch(url, { headers: { accept: "text/html", "accept-language": "fr" }, signal: AbortSignal.timeout(30_000) })).text();
        const text = htmlToText(html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ""));
        await tracedQuery(actor, "EUR-Lex", `CELEX ${celex} (${Date.now() - t0} ms)`, "select 1");
        return `${url}\n${text.slice(0, 8000)}`;
      },
    }),
    betaZodTool({
      name: "submit_dossier",
      description: "Rend ton dossier : les articles (identifiants LEGIARTI) que le juge doit lire, chacun avec la raison de sa pertinence. Inclure la règle de compétence applicable, les règles de fond, et tout article qui pourrait rendre la disposition CONFORME. À appeler une fois, en dernier.",
      inputSchema: z.object({
        candidates: z
          .array(z.object({ article_id: z.string(), why: z.string(), dispositions: z.array(z.string()).optional().describe("Dispositions concernées (d1, d2…) ; vide = toutes") }))
          .min(1)
          .max(12),
        notes: z.string().describe("Ce que tu as cherché sans trouver, actes locaux ou textes UE pertinents"),
      }),
      run: async ({ candidates, notes }) => {
        const found = await getArticles(actor, candidates.map((c) => c.article_id));
        const known = new Set(found.map((a) => a.id));
        const unknown = candidates.filter((c) => !known.has(c.article_id)).map((c) => c.article_id);
        if (unknown.length) throw new Error(`Identifiants inconnus : ${unknown.join(", ")}. Utilise uniquement des LEGIARTI renvoyés par les outils.`);
        candidates.forEach((c) => {
          state.candidates.set(c.article_id, c.why);
          state.assign?.set(c.article_id, c.dispositions ?? []);
        });
        state.candidates.set("__notes__", notes);
        return "Dossier reçu. Termine sans autre texte.";
      },
    }),
  ];
}

export { legifranceArticleUrl };
