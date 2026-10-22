// Front minimal : Explorer (treemap Plotly) + Analyste (4 pods + chat).
const $ = (id) => document.getElementById(id);
let allStartups = [];
let current = null; // startup affichée dans la vue Analyste

// ---------- utilitaires
async function api(path, options = {}) {
  const res = await fetch(path, { headers: { "Content-Type": "application/json" }, ...options });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || res.statusText);
  return res.json();
}
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const linkify = (s) => esc(s).replace(/https?:\/\/[^\s)\]]+/g, (u) => `<a href="${u}" target="_blank">${u}</a>`);
const day = (d) => (d ? String(d).slice(0, 10) : "?");
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } };

function show(view) {
  $("view-explorer").hidden = view !== "explorer";
  $("view-analyst").hidden = view !== "analyst";
  $("tab-explorer").classList.toggle("active", view === "explorer");
  $("tab-analyst").classList.toggle("active", view === "analyst");
}
$("tab-explorer").onclick = () => show("explorer");
$("tab-analyst").onclick = () => current && show("analyst");

function setStatus(text, isError = false) {
  $("status").hidden = !text;
  $("status").textContent = text || "";
  $("status").classList.toggle("error", isError);
}

// ---------- Explorer
async function loadStartups() {
  allStartups = await api("/startups");
  const regions = [...new Set(allStartups.map((s) => s.region).filter(Boolean))].sort();
  $("region").innerHTML = '<option value="">Toutes les régions</option>' +
    regions.map((r) => `<option>${esc(r)}</option>`).join("");
  drawTreemap();
}

function drawTreemap() {
  const region = $("region").value;
  const q = $("search").value.trim().toLowerCase();
  const rows = allStartups.filter((s) =>
    (!region || s.region === region) &&
    (!q || [s.name, s.sector, s.description].some((v) => (v || "").toLowerCase().includes(q))));
  $("count").textContent = `${rows.length} startups — cliquez sur un secteur pour zoomer, sur une startup pour l'analyser.`;

  const sectors = [...new Set(rows.map((s) => s.sector || "Autre"))];
  const ids = [...sectors, ...rows.map((s) => s.id)];
  const labels = [...sectors, ...rows.map((s) => s.name)];
  const parents = [...sectors.map(() => ""), ...rows.map((s) => s.sector || "Autre")];
  // Taille = financement total si connu, sinon 1 (toutes les cases égales).
  const values = [...sectors.map(() => 0), ...rows.map((s) => Number(s.funding_total_usd) || 1)];
  const text = [...sectors.map(() => ""), ...rows.map((s) => [s.city, s.country].filter(Boolean).join(", "))];

  Plotly.react("treemap", [{
    type: "treemap", ids, labels, parents, values, text,
    textinfo: "label+text", hovertemplate: "<b>%{label}</b><br>%{text}<extra></extra>",
    marker: { colorscale: "Blues" }, pathbar: { visible: true },
  }], { margin: { t: 30, l: 8, r: 8, b: 8 } }, { displayModeBar: false, responsive: true });

  $("treemap").removeAllListeners?.("plotly_treemapclick");
  $("treemap").on("plotly_treemapclick", (ev) => {
    const id = ev.points[0].id;
    if (sectors.includes(id)) return true; // secteur : zoom normal
    openStartup(id);
    return false;
  });
}
$("region").onchange = drawTreemap;
$("search").oninput = drawTreemap;

$("resolve-form").onsubmit = async (e) => {
  e.preventDefault();
  const url = $("resolve-url").value.trim();
  if (!url) return;
  try {
    const s = await api("/resolve", { method: "POST", body: JSON.stringify({ url }) });
    if (!allStartups.some((x) => x.id === s.id)) allStartups.push(s);
    openStartup(s.id);
  } catch (err) { alert(err.message); }
};

// ---------- Analyste
async function openStartup(id) {
  const dash = await api(`/startups/${encodeURIComponent(id)}`);
  current = dash.startup;
  $("tab-analyst").disabled = false;
  show("analyst");
  renderHeader(current);
  renderPods(dash);
  $("memo-md").href = `/memo/${encodeURIComponent(id)}?format=md`;
  $("memo-html").href = `/memo/${encodeURIComponent(id)}?format=html`;
  renderMessages(await api(`/chat/${encodeURIComponent(id)}`));
  const empty = Object.values(dash.pods).every((p) => p.facts.length === 0);
  if (empty) runAnalysis(false);
}

function renderHeader(s) {
  $("s-name").textContent = s.name;
  $("s-meta").textContent = [s.sector, [s.city, s.country].filter(Boolean).join(", "),
    s.founded_year && `fondée en ${s.founded_year}`, s.website].filter(Boolean).join(" · ");
  $("s-desc").textContent = s.description || "";
}

function renderPods(dash) {
  $("pods").innerHTML = Object.values(dash.pods).map((pod) => `
    <div class="pod"><h3>${esc(pod.label)}</h3>
      ${pod.facts.length ? `<ul>${pod.facts.map((f) => `<li>${esc(f.content)}
          <span class="src">${f.source_url.startsWith("http")
            ? `<a href="${esc(f.source_url)}" target="_blank">${esc(host(f.source_url))}</a>` : esc(f.source_url)}
            · récupéré le ${day(f.fetched_at)}</span></li>`).join("")}</ul>`
        : '<p class="muted">Pas encore de faits sourcés.</p>'}
    </div>`).join("");
  const errors = Object.entries(dash.errors || {});
  if (errors.length) setStatus("Erreurs : " + errors.map(([p, e]) => `${p} → ${e}`).join(" | "), true);
}

async function runAnalysis(refresh) {
  const id = current.id;
  $("btn-refresh").disabled = true;
  setStatus("Les 4 agents (Marché, Équipe, Produit, ICP) analysent en parallèle… (1 à 2 min)");
  try {
    const dash = await api(`/analyze/${encodeURIComponent(id)}?refresh=${refresh}`, { method: "POST" });
    if (current.id !== id) return;
    setStatus("");
    renderPods(dash);
  } catch (err) {
    setStatus("Analyse impossible : " + err.message, true);
  } finally {
    $("btn-refresh").disabled = false;
  }
}
$("btn-refresh").onclick = () => runAnalysis(true);

function renderMessages(msgs) {
  $("messages").innerHTML = msgs.map((m) => `<div class="msg ${m.role}">${linkify(m.content)}</div>`).join("");
  $("messages").scrollTop = $("messages").scrollHeight;
}

$("chat-form").onsubmit = async (e) => {
  e.preventDefault();
  const message = $("chat-input").value.trim();
  if (!message || !current) return;
  $("chat-input").value = "";
  const box = $("messages");
  box.insertAdjacentHTML("beforeend", `<div class="msg user">${esc(message)}</div><div class="msg assistant" id="pending">…</div>`);
  box.scrollTop = box.scrollHeight;
  try {
    const res = await api("/chat", { method: "POST", body: JSON.stringify({ startup_id: current.id, message }) });
    $("pending").outerHTML = `<div class="msg assistant">${linkify(res.answer)}</div>`;
  } catch (err) {
    $("pending").outerHTML = `<div class="msg assistant">Erreur : ${esc(err.message)}</div>`;
  }
  box.scrollTop = box.scrollHeight;
};

loadStartups().catch((err) => { $("count").textContent = "Erreur de chargement : " + err.message; });
