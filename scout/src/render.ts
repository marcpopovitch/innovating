// Une page HTML autonome : la fiche entreprise, chaque chiffre relié à sa preuve.
import type { Evidence } from "./evidence.js";
import { POD_BRIEFS } from "./agents.js";
import type { Analysis } from "./orchestrator.js";

const esc = (value: unknown) =>
  String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const CONFIDENCE_LABEL = { observed: "observé", derived: "calculé", inferred: "déduit" } as const;

export function renderHtml(a: Analysis): string {
  const index = new Map(a.evidence.map((e, i) => [e.id, { n: i + 1, e }]));
  const cite = (ids: string[]) =>
    ids
      .map((id) => index.get(id))
      .filter((x): x is { n: number; e: Evidence } => !!x)
      .map(({ n, e }) => `<a class="cite c-${e.confidence}" href="#${e.id}" title="${esc(`${e.source}${e.as_of ? ` · ${e.as_of}` : ""} · ${CONFIDENCE_LABEL[e.confidence]}\n${e.claim}`)}">${n}</a>`)
      .join("");
  const cited = (items: Array<{ point: string; evidence_ids: string[] }>) =>
    items.length ? `<ul>${items.map((i) => `<li>${esc(i.point)} ${cite(i.evidence_ids)}</li>`).join("")}</ul>` : `<p class="muted">Rien de saillant.</p>`;

  const ids = a.identity.legalIds;
  const chips = [
    a.identity.legalName && `Entité : ${a.identity.legalName}`,
    ids.entity && !a.identity.legalName && `Entité : ${ids.entity}`,
    ids.siren && `SIREN ${ids.siren}`,
    ids.hrb,
    ids.companyNumber && `Companies House ${ids.companyNumber}`,
  ].filter(Boolean);
  const s = a.synthesis;
  const usedSources = new Set(a.evidence.map((e) => e.source)).size;

  const podCards = a.pods
    .map(
      (p) => `
    <article class="card pod">
      <header><h3>${esc(POD_BRIEFS[p.pod].title)}</h3>${p.submitted ? "" : `<span class="pill warn">incomplet</span>`}</header>
      <p>${esc(p.report.summary)}</p>
      ${p.report.metrics.length ? `<table class="metrics">${p.report.metrics.map((m) => `<tr><th>${esc(m.label)}</th><td>${esc(m.value)} ${cite(m.evidence_ids)}</td></tr>`).join("")}</table>` : ""}
      ${p.report.unknowns.length ? `<div class="unknowns"><strong>Non établi</strong><ul>${p.report.unknowns.map((u) => `<li>${esc(u)}</li>`).join("")}</ul></div>` : ""}
      <details><summary>${p.steps.length} étapes de recherche</summary><ol class="steps">${p.steps.map((st) => `<li>${esc(st)}</li>`).join("")}</ol></details>
    </article>`,
    )
    .join("");

  const evidenceRows = a.evidence
    .map(
      (e, i) => `<tr id="${e.id}">
      <td class="num">${i + 1}</td>
      <td>${esc(e.claim)}${e.limitations.length ? `<div class="limits">⚠︎ ${e.limitations.map(esc).join(" · ")}</div>` : ""}</td>
      <td>${e.url ? `<a href="${esc(e.url)}" target="_blank" rel="noopener">${esc(e.source)}</a>` : esc(e.source)}</td>
      <td class="nowrap">${esc(e.as_of ?? "—")}</td>
      <td><span class="pill c-${e.confidence}">${CONFIDENCE_LABEL[e.confidence]}</span></td>
      <td class="muted">${esc(e.authority)}</td>
    </tr>`,
    )
    .join("");

  const sourceRows = a.sources
    .map((src) => `<li><span class="pill ${src.status === "eviter" ? "bad" : src.enabled ? "ok" : "off"}">${src.status === "eviter" ? "évité" : src.enabled ? "branché" : "clé du fonds"}</span> <strong>${esc(src.name)}</strong> <span class="muted">— ${esc(src.pods)}. ${esc(src.note)}</span></li>`)
    .join("");

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(a.identity.name)} — fiche Scout</title>
<style>
:root{--bg:#fafaf9;--card:#fff;--ink:#18181b;--muted:#71717a;--line:#e4e4e7;--accent:#2563eb;--ok:#15803d;--warn:#b45309;--bad:#b91c1c;--obs:#dbeafe;--der:#ede9fe;--inf:#fef3c7}
@media (prefers-color-scheme:dark){:root{--bg:#0b0b0d;--card:#151518;--ink:#f4f4f5;--muted:#a1a1aa;--line:#27272a;--accent:#60a5fa;--obs:#1e3a8a;--der:#4c1d95;--inf:#78350f}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.55 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:1180px;margin:0 auto;padding:32px 16px 80px}
h1{font-size:34px;margin:0;letter-spacing:-.02em}h2{font-size:20px;margin:40px 0 12px}h3{margin:0;font-size:16px}
a{color:var(--accent)}.muted{color:var(--muted)}.nowrap{white-space:nowrap}
.top{display:flex;flex-wrap:wrap;gap:12px;align-items:baseline;justify-content:space-between}
.chips{display:flex;flex-wrap:wrap;gap:6px;margin:12px 0}.chip{border:1px solid var(--line);border-radius:999px;padding:2px 10px;font-size:13px}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin:20px 0}
.stat{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:12px 14px}.stat b{display:block;font-size:24px}
.card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:18px}
.verdict p.lead{font-size:19px;margin:0 0 8px;font-weight:600}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:14px}
.pod header{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px}
table{width:100%;border-collapse:collapse}.metrics th{text-align:left;font-weight:500;color:var(--muted);padding:6px 10px 6px 0;vertical-align:top;width:40%}
.metrics td{padding:6px 0}.metrics tr+tr{border-top:1px solid var(--line)}
.unknowns{margin-top:10px;font-size:13px;color:var(--muted)}.unknowns ul{margin:4px 0 0;padding-left:18px}
details{margin-top:10px;font-size:13px;color:var(--muted)}.steps{padding-left:18px;margin:6px 0 0;font-family:ui-monospace,monospace;font-size:12px}
.cite{display:inline-block;min-width:18px;text-align:center;font-size:11px;font-weight:600;line-height:18px;border-radius:6px;margin-left:3px;text-decoration:none;color:var(--ink);vertical-align:1px}
.c-observed{background:var(--obs)}.c-derived{background:var(--der)}.c-inferred{background:var(--inf)}
.cases{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px}.cases ul{padding-left:18px;margin:6px 0 0}.cases li{margin-bottom:6px}
.bear{border-color:color-mix(in srgb,var(--bad) 35%,var(--line))}.bull{border-color:color-mix(in srgb,var(--ok) 35%,var(--line))}
.pill{display:inline-block;border-radius:999px;padding:1px 9px;font-size:12px;font-weight:600}
.pill.ok{background:color-mix(in srgb,var(--ok) 18%,transparent);color:var(--ok)}.pill.off{background:var(--line);color:var(--muted)}
.pill.bad{background:color-mix(in srgb,var(--bad) 15%,transparent);color:var(--bad)}.pill.warn{background:color-mix(in srgb,var(--warn) 18%,transparent);color:var(--warn)}
.evidence{overflow-x:auto}.evidence table{font-size:13px;min-width:760px}.evidence th{text-align:left;color:var(--muted);font-weight:500;border-bottom:1px solid var(--line);padding:8px}
.evidence td{padding:8px;border-bottom:1px solid var(--line);vertical-align:top}.num{color:var(--muted);font-variant-numeric:tabular-nums}
.limits{color:var(--warn);font-size:12px;margin-top:3px}tr:target{background:color-mix(in srgb,var(--accent) 12%,transparent)}
.sources ul{list-style:none;padding:0;margin:0}.sources li{padding:6px 0;border-bottom:1px solid var(--line)}
.legend{font-size:12px;color:var(--muted)}.legend .cite{margin:0 4px 0 10px}
.errors{border-color:var(--bad);color:var(--bad)}
</style>
</head>
<body><main>
<div class="top"><div><h1>${esc(a.identity.name)}</h1><a href="${esc(a.identity.url)}">${esc(a.identity.domain)}</a></div>
<span class="muted">Généré le ${esc(new Date(a.generated_at).toLocaleString("fr-FR"))} en ${a.duration_s} s</span></div>
<div class="chips">${chips.map((c) => `<span class="chip">${esc(c)}</span>`).join("")}</div>
<div class="stats">
  <div class="stat"><b>${a.evidence.length}</b>preuves sourcées</div>
  <div class="stat"><b>${usedSources}</b>sources distinctes</div>
  <div class="stat"><b>${a.evidence.filter((e) => e.authority === "registre-officiel").length}</b>faits de registres officiels</div>
  <div class="stat"><b>${a.pods.length}</b>sous-agents</div>
</div>
${a.errors.length ? `<div class="card errors"><strong>Erreurs</strong><ul>${a.errors.map((e) => `<li>${esc(e)}</li>`).join("")}</ul></div>` : ""}
${s ? `<section class="card verdict"><p class="lead">${esc(s.one_liner)}</p><p>${esc(s.verdict)}</p></section>` : ""}
${a.pods.length ? `<h2>Analyse par axe</h2><p class="legend">Chaque pastille renvoie à sa preuve :<span class="cite c-observed">1</span>observé<span class="cite c-derived">2</span>calculé<span class="cite c-inferred">3</span>déduit</p><div class="grid">${podCards}</div>` : ""}
${s ? `<h2>Note de comité</h2><div class="cases">
  <div class="card bull"><h3>Bull case</h3>${cited(s.bull_case)}</div>
  <div class="card bear"><h3>Bear case</h3>${cited(s.bear_case)}</div>
  <div class="card"><h3>Signaux d'alerte</h3>${cited(s.red_flags)}</div>
  <div class="card"><h3>Questions aux fondateurs</h3><ul>${s.questions_for_founders.map((q) => `<li>${esc(q)}</li>`).join("")}</ul></div>
</div>` : ""}
<h2>Registre des preuves</h2>
<div class="card evidence"><table><thead><tr><th>#</th><th>Fait</th><th>Source</th><th>Date</th><th>Confiance</th><th>Autorité</th></tr></thead><tbody>${evidenceRows}</tbody></table></div>
<h2>Sources</h2>
<div class="card sources"><ul>${sourceRows}</ul></div>
</main></body></html>`;
}
