// Signaux de traction et d'équipe gratuits : offres d'emploi publiques (ATS),
// GitHub, publications scientifiques (OpenAlex).
import type { EvidenceInput } from "../evidence.js";
import { getJson, getJsonOrNull } from "./http.js";

interface Job {
  title: string;
  team: string;
  location: string;
  published?: string;
}

// Endpoints publics que les ATS exposent pour les pages carrières des clients.
const ATS: Record<string, { url: (slug: string) => string; page: (slug: string) => string; parse: (data: any) => Job[] }> = {
  ashby: {
    url: (s) => `https://api.ashbyhq.com/posting-api/job-board/${s}`,
    page: (s) => `https://jobs.ashbyhq.com/${s}`,
    parse: (d) => (d?.jobs ?? []).map((j: any) => ({ title: j.title, team: j.department ?? j.team ?? "—", location: j.location ?? "—", published: j.publishedAt })),
  },
  greenhouse: {
    url: (s) => `https://boards-api.greenhouse.io/v1/boards/${s}/jobs?content=true`,
    page: (s) => `https://job-boards.greenhouse.io/${s}`,
    parse: (d) => (d?.jobs ?? []).map((j: any) => ({ title: j.title, team: j.departments?.[0]?.name ?? "—", location: j.location?.name ?? "—", published: j.updated_at })),
  },
  lever: {
    url: (s) => `https://api.lever.co/v0/postings/${s}?mode=json`,
    page: (s) => `https://jobs.lever.co/${s}`,
    parse: (d) => (Array.isArray(d) ? d : []).map((j: any) => ({ title: j.text, team: j.categories?.team ?? "—", location: j.categories?.location ?? "—", published: j.createdAt ? new Date(j.createdAt).toISOString() : undefined })),
  },
  workable: {
    url: (s) => `https://apply.workable.com/api/v1/widget/accounts/${s}`,
    page: (s) => `https://apply.workable.com/${s}`,
    parse: (d) => (d?.jobs ?? []).map((j: any) => ({ title: j.title, team: j.department ?? "—", location: j.city ?? j.country ?? "—", published: j.published_on })),
  },
};

/** Essaie chaque ATS avec le slug donné ; renvoie les faits du premier qui répond. */
export async function jobsEvidence(slug: string): Promise<EvidenceInput[]> {
  const today = new Date().toISOString().slice(0, 10);
  for (const [name, ats] of Object.entries(ATS)) {
    const data = await getJsonOrNull(ats.url(slug)).catch(() => null);
    const jobs = data ? ats.parse(data) : [];
    if (!jobs.length) continue;
    const byTeam = new Map<string, number>();
    for (const j of jobs) byTeam.set(j.team, (byTeam.get(j.team) ?? 0) + 1);
    const teams = [...byTeam].sort((a, b) => b[1] - a[1]);
    const base = { source: `Offres d'emploi publiques (${name})`, url: ats.page(slug), as_of: today, authority: "donnee-publique" as const, confidence: "observed" as const };
    return [
      { ...base, claim: `${jobs.length} offres d'emploi ouvertes sur ${name}`, value: jobs.length },
      { ...base, claim: `Recrutements par équipe : ${teams.map(([t, n]) => `${t} ${n}`).join(", ")}`, value: Object.fromEntries(teams) },
      {
        ...base,
        claim: `Exemples de postes : ${jobs.slice(0, 12).map((j) => `${j.title} (${j.location})`).join(" ; ")}`,
        value: jobs.slice(0, 25),
        limitations: ["Une offre ouverte n'est pas une embauche ; certaines boîtes laissent des offres « vivier »"],
      },
    ];
  }
  return [];
}

const GITHUB_HEADERS = (): Record<string, string> =>
  process.env.GITHUB_TOKEN ? { authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {};

export async function githubEvidence(org: string): Promise<EvidenceInput[]> {
  const headers = GITHUB_HEADERS();
  const info = await getJsonOrNull<any>(`https://api.github.com/orgs/${org}`, { headers });
  if (!info) return [];
  const repos = await getJson<any[]>(`https://api.github.com/orgs/${org}/repos?per_page=100&sort=pushed`, { headers });
  const stars = repos.reduce((sum, r) => sum + r.stargazers_count, 0);
  const top = [...repos].sort((a, b) => b.stargazers_count - a.stargazers_count).slice(0, 5);
  const base = { source: "GitHub API", url: info.html_url, as_of: new Date().toISOString().slice(0, 10), authority: "donnee-publique" as const, confidence: "observed" as const };
  return [
    { ...base, claim: `Organisation GitHub ${org} : ${info.public_repos} dépôts publics, ${info.followers} abonnés, créée le ${info.created_at.slice(0, 10)}`, value: { repos: info.public_repos, followers: info.followers, created: info.created_at } },
    {
      ...base,
      claim: `${stars} étoiles au total ; dépôts phares : ${top.map((r) => `${r.name} (${r.stargazers_count}★, dernier push ${r.pushed_at.slice(0, 10)})`).join(", ")}`,
      value: top.map((r) => ({ name: r.name, stars: r.stargazers_count, pushed: r.pushed_at, language: r.language })),
      limitations: ["Mesure l'activité open source, pas le produit propriétaire"],
    },
  ];
}

/** Publications scientifiques d'une personne (utile en deeptech). */
export async function openAlexEvidence(person: string): Promise<EvidenceInput[]> {
  const key = process.env.OPENALEX_API_KEY ? `&api_key=${process.env.OPENALEX_API_KEY}` : "";
  const { results } = await getJson<{ results: any[] }>(
    `https://api.openalex.org/authors?search=${encodeURIComponent(person)}&per_page=3${key}`,
  );
  return results.map((a) => ({
    claim: `OpenAlex : ${a.display_name} — ${a.works_count} publications, ${a.cited_by_count} citations, h-index ${a.summary_stats?.h_index ?? "?"}, affiliation ${a.last_known_institutions?.[0]?.display_name ?? "inconnue"}`,
    value: { works: a.works_count, citations: a.cited_by_count, h_index: a.summary_stats?.h_index },
    source: "OpenAlex",
    url: a.id,
    authority: "donnee-publique",
    confidence: "observed",
    limitations: ["Homonymes possibles : vérifier l'affiliation avant de conclure"],
  }));
}
