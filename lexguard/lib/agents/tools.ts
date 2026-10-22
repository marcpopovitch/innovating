// Les outils des agents chercheurs : tout passe par la base (corpus DILA, JO, actes
// locaux) ou par EUR-Lex. Chaque requête est tracée dans query_log.
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { tracedQuery } from "../db";
import { htmlToText, legifranceArticleUrl } from "../dila";

export interface ArticleHit {
  id: string;
  code_title: string;
  num: string | null;
  etat: string;
  section: string | null;
  snippet: string;
}

export async function searchCorpus(actor: string, query: string, code?: string, limit = 8): Promise<ArticleHit[]> {
  return tracedQuery<ArticleHit>(
    actor,
    "recherche plein texte",
    `articles « ${query} »${code ? ` dans ${code}` : ""}`,
    `select id, code_title, num, etat, section,
            ts_headline('french', text, q, 'MaxWords=45, MinWords=20, StartSel=«, StopSel=»') as snippet
       from articles, websearch_to_tsquery('french', $1) q
      where tsv @@ q and etat = 'VIGUEUR' and ($2::text is null or code_title ilike '%' || $2 || '%')
      order by ts_rank_cd(tsv, q) desc
      limit $3`,
    [query, code ?? null, limit],
  );
}

export interface FullArticle {
  id: string;
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
    `select id, cid, code_title, num, section, text, etat, date_debut::text, date_fin::text from articles where id = any($1)`,
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
    `select id, cid, code_title, num, section, text, etat, date_debut::text, date_fin::text
       from articles
      where replace(replace(num, ' ', ''), '.', '') = replace($1, '.', '') and etat = 'VIGUEUR'
        and ($2::text is null or code_title ilike '%' || $2 || '%')
      limit 3`,
    [clean, code ?? null],
  );
}

export function makeResearchTools(actor: string, state: { candidates: Map<string, string>; consulted: Set<string> }) {
  const fmtHits = (hits: ArticleHit[]) =>
    hits.length ? hits.map((h) => `${h.id} | ${h.code_title} art. ${h.num ?? "?"} | ${h.section ?? ""}\n   ${h.snippet.replace(/\s+/g, " ")}`).join("\n") : "Aucun article en vigueur ne correspond. Reformule (synonymes juridiques, termes plus généraux).";

  return [
    betaZodTool({
      name: "search_corpus",
      description: "Recherche plein texte (français, opérateurs websearch : guillemets, OR, -) dans les articles EN VIGUEUR des codes : CGCT, Code rural, Code de la route, Code de la santé publique, Code de l'environnement, Code de l'urbanisme, Code de la sécurité intérieure, Code pénal, CRPA. Filtre optionnel `code` (sous-chaîne du nom du code).",
      inputSchema: z.object({ query: z.string(), code: z.string().optional() }),
      run: async ({ query, code }) => {
        const hits = await searchCorpus(actor, query, code);
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
            return `${a.id} | ${a.code_title} art. ${a.num} | ${a.etat} du ${a.date_debut ?? "?"} au ${a.date_fin ?? "…"}\nSection : ${a.section ?? "—"}\n${a.text.slice(0, 6000)}`;
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
        const url = `https://eur-lex.europa.eu/legal-content/FR/TXT/HTML/?uri=CELEX:${celex}`;
        const t0 = Date.now();
        const html = await (await fetch(url, { signal: AbortSignal.timeout(20_000) })).text();
        const text = htmlToText(html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ""));
        await tracedQuery(actor, "EUR-Lex", `CELEX ${celex} (${Date.now() - t0} ms)`, "select 1");
        return `${url}\n${text.slice(0, 8000)}`;
      },
    }),
    betaZodTool({
      name: "web_search",
      description:
        "Recherche web (Keenable) — complément au corpus pour la jurisprudence, la doctrine, les circulaires, ou vérifier l'état d'un texte absent de la base DILA. Option `site` pour se restreindre à une source officielle (ex. « legifrance.gouv.fr », « conseil-etat.fr », « senat.fr »). Jamais pour inventer : cite l'URL renvoyée.",
      inputSchema: z.object({
        query: z.string(),
        site: z.string().optional().describe("Restreint à un domaine, ex. « legifrance.gouv.fr »"),
      }),
      run: async ({ query, site }) => {
        const key = process.env.KEENABLE_API_KEY;
        if (!key) return "Recherche web indisponible (KEENABLE_API_KEY non configurée).";
        const t0 = Date.now();
        try {
          const res = await fetch("https://api.keenable.ai/v1/search", {
            method: "POST",
            headers: { "content-type": "application/json", "x-api-key": key },
            // site: undefined est omis par JSON.stringify ; on tronque côté serveur pour épargner des tokens.
            body: JSON.stringify({ query, site, max_results: 6, snippet_max_length: 600 }),
            signal: AbortSignal.timeout(20_000),
          });
          if (!res.ok) return `Recherche web : erreur ${res.status}.`;
          const data = (await res.json()) as {
            results?: Array<{ title?: string; url?: string; description?: string; snippet?: string; published_at?: string }>;
          };
          const arr = data.results ?? [];
          await tracedQuery(actor, "recherche web (Keenable)", `« ${query} »${site ? ` site:${site}` : ""} (${Date.now() - t0} ms)`, "select 1");
          const rows = arr.map((r) => {
            const date = r.published_at ? ` (${r.published_at.slice(0, 10)})` : "";
            const body = (r.snippet || r.description || "").replace(/\s+/g, " ");
            return `${r.title ?? r.url ?? ""}${date}\n   ${r.url ?? ""}\n   ${body}`;
          });
          return rows.length ? rows.join("\n") : "Aucun résultat web.";
        } catch (e) {
          return `Recherche web indisponible (${e instanceof Error ? e.message : "erreur"}).`;
        }
      },
    }),
    betaZodTool({
      name: "submit_dossier",
      description: "Rend ton dossier : les articles (identifiants LEGIARTI) que le juge doit lire, chacun avec la raison de sa pertinence. Inclure la règle de compétence applicable, les règles de fond, et tout article qui pourrait rendre la disposition CONFORME. À appeler une fois, en dernier.",
      inputSchema: z.object({
        candidates: z.array(z.object({ article_id: z.string(), why: z.string() })).min(1).max(10),
        notes: z.string().describe("Ce que tu as cherché sans trouver, actes locaux ou textes UE pertinents"),
      }),
      run: async ({ candidates, notes }) => {
        const found = await getArticles(actor, candidates.map((c) => c.article_id));
        const known = new Set(found.map((a) => a.id));
        const unknown = candidates.filter((c) => !known.has(c.article_id)).map((c) => c.article_id);
        if (unknown.length) throw new Error(`Identifiants inconnus : ${unknown.join(", ")}. Utilise uniquement des LEGIARTI renvoyés par les outils.`);
        candidates.forEach((c) => state.candidates.set(c.article_id, c.why));
        state.candidates.set("__notes__", notes);
        return "Dossier reçu. Termine sans autre texte.";
      },
    }),
  ];
}

export { legifranceArticleUrl };
