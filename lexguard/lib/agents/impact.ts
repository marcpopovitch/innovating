// Agent de veille : pour chaque texte récent du JO, retrouve les actes locaux
// touchés (même article de code cité, ou même sujet), puis demande à Claude de
// confirmer l'impact et de l'expliquer. Sans clé API, seul le rapprochement
// déterministe (même article cité) est conservé.
import { z } from "zod";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { db, tracedQuery } from "../db";
import { anthropic, CostMeter, FALLBACK, MODELS } from "./llm";

interface JoText {
  id: string;
  title: string;
  nature: string;
  text: string | null;
  modifies: Array<{ title: string }>;
}
interface Candidate {
  id: number;
  collectivite: string;
  title: string;
  excerpt: string;
  reason: string;
}

const ARTICLE_NUM = /art\.\s*([LRDA]\.?\s?\d[\d-]*)/i;

async function candidates(jo: JoText): Promise<Candidate[]> {
  const found = new Map<number, Candidate>();
  // 1. Même article du même code cité par le texte du JO et par l'acte local.
  const refs = new Map<string, { num: string; code: string }>();
  for (const m of jo.modifies) {
    const num = m.title.match(ARTICLE_NUM)?.[1]?.replace(/[.\s]/g, "");
    const code = m.title.split(" - ")[0]?.trim();
    if (num && code?.toLowerCase().startsWith("code")) refs.set(`${code}|${num}`, { num, code });
  }
  for (const { num, code } of [...refs.values()].slice(0, 12)) {
    const spaced = num.replace(/^([LRDA])/, "$1. ");
    const rows = await tracedQuery<{ id: number; collectivite: string; title: string; excerpt: string }>(
      "veilleur",
      "rapprochement par article",
      `actes citant ${code} ${num}`,
      `select id, collectivite, title, substr(coalesce(text, ''), greatest(position($1 in coalesce(text, '')) - 200, 1), 500) as excerpt
         from local_acts where (text ilike '%' || $1 || '%' or text ilike '%' || $2 || '%') and text ilike '%' || $3 || '%' limit 5`,
      [num, spaced, code],
    );
    for (const r of rows) found.set(r.id, { ...r, reason: `cite aussi l'article ${num} du ${code.charAt(0).toLowerCase()}${code.slice(1)}` });
  }
  // 2. Même sujet (plein texte sur le titre du texte du JO).
  const topic = await tracedQuery<{ id: number; collectivite: string; title: string; excerpt: string }>(
    "veilleur",
    "rapprochement thématique",
    `actes proches de « ${jo.title.slice(0, 80)} »`,
    `select id, collectivite, title, left(coalesce(text, title), 500) as excerpt
       from local_acts, plainto_tsquery('french', $1) q
      where tsv @@ q order by ts_rank_cd(tsv, q) desc limit 3`,
    [jo.title.replace(/^(Arrêté|Décret|Loi|Ordonnance)[^a-z]*du \d+ \S+ \d{4}\s*/i, "").slice(0, 200)],
  );
  for (const r of topic) if (!found.has(r.id)) found.set(r.id, { ...r, reason: "même sujet" });
  return [...found.values()].slice(0, 6);
}

const ImpactSchema = z.object({
  impacts: z.array(z.object({ act_id: z.number(), impacted: z.boolean(), reason: z.string().describe("Pourquoi l'acte local doit être revu (une phrase), ou pourquoi non") })),
});

export async function runVeille(days = 2, log: (m: string) => void = console.log) {
  const client = await db();
  const meter = new CostMeter();
  const useLlm = !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
  const { rows: texts } = await client.query<JoText>(
    `select id, title, nature, left(text, 6000) as text, modifies from jo_texts
      where nature in ('LOI', 'ORDONNANCE', 'DECRET', 'ARRETE') and date_publi >= (select max(date_publi) - $1::int from jo_texts)`,
    [days],
  );
  let stored = 0;
  for (const jo of texts) {
    const cands = await candidates(jo);
    if (!cands.length) continue;
    let confirmed = cands.filter((c) => c.reason.startsWith("cite aussi")).map((c) => ({ c, reason: `Le texte ${c.reason} : à vérifier.` }));
    if (useLlm) {
      const res = await anthropic().beta.messages.parse({
        model: MODELS.fast,
        max_tokens: 4000,
        output_config: { effort: "low", format: betaZodOutputFormat(ImpactSchema) },
        ...FALLBACK,
        system: "Tu fais la veille juridique d'une préfecture. Un texte vient de paraître au Journal officiel. Pour chaque acte local candidat, dis s'il doit être revu (il applique, cite ou contredit une règle que ce texte crée, modifie ou abroge). Sois strict : un simple sujet voisin ne suffit pas.",
        messages: [{ role: "user", content: `Texte du JO : ${jo.title}\nArticles visés : ${jo.modifies.map((m) => m.title).slice(0, 15).join(" ; ")}\n${jo.text ?? ""}\n\nActes locaux candidats :\n${cands.map((c) => `#${c.id} [${c.collectivite}] ${c.title}\n${c.excerpt}`).join("\n\n")}` }],
      });
      meter.add(MODELS.fast, res.usage);
      const parsed = res.parsed_output?.impacts ?? [];
      confirmed = parsed.filter((p) => p.impacted).flatMap((p) => {
        const c = cands.find((x) => x.id === p.act_id);
        return c ? [{ c, reason: p.reason }] : [];
      });
    }
    for (const { c, reason } of confirmed) {
      await client.query("insert into veille_impacts (jo_id, collectivite, act_title, reason) values ($1, $2, $3, $4) on conflict do nothing", [jo.id, c.collectivite, c.title, reason]);
      stored += 1;
    }
  }
  log(`${texts.length} textes du JO examinés, ${stored} impacts enregistrés${useLlm ? `, coût ${meter.usd.toFixed(3)} $` : " (sans IA : rapprochements par article seulement)"}`);
  return stored;
}
