"""Export du mémo sourcé (markdown ou HTML), construit uniquement à partir des faits en base.
Pas d'appel à Claude ici : le mémo ne peut contenir que des faits déjà sourcés."""
from html import escape

from agent.orchestrator import dashboard


def _date(value) -> str:
    return str(value)[:10] if value else "?"


def _build(startup_id: str):
    d = dashboard(startup_id)
    s = d["startup"]
    urls: list[str] = []
    fetched = {}
    sections = []
    for pod in d["pods"].values():
        lines = []
        for f in pod["facts"]:
            if f["source_url"] not in urls:
                urls.append(f["source_url"])
            fetched[f["source_url"]] = f["fetched_at"]
            lines.append((f["content"], urls.index(f["source_url"]) + 1))
        sections.append((pod["label"], lines))
    profile = [
        ("Site", s.get("website")), ("Secteur", s.get("sector")),
        ("Localisation", ", ".join(x for x in (s.get("city"), s.get("country"), s.get("region")) if x)),
        ("Création", s.get("founded_year")), ("Effectif", s.get("headcount")),
        ("Financement total (USD)", s.get("funding_total_usd")), ("Données", s.get("data_source")),
    ]
    return s, [(k, v) for k, v in profile if v], sections, [(u, _date(fetched.get(u))) for u in urls]


def to_markdown(startup_id: str) -> str:
    s, profile, sections, sources = _build(startup_id)
    out = [f"# Mémo — {s['name']}", "", f"_{s.get('description') or ''}_", ""]
    out += [f"- **{k}** : {v}" for k, v in profile] + [""]
    for label, lines in sections:
        out += [f"## {label}", ""]
        out += [f"- {text} [{n}]" for text, n in lines] or ["- _Pas de donnée sourcée._"]
        out.append("")
    out += ["## Sources", ""] + [f"{i}. {url} (récupéré le {date})" for i, (url, date) in enumerate(sources, 1)]
    return "\n".join(out) + "\n"


def to_html(startup_id: str) -> str:
    s, profile, sections, sources = _build(startup_id)
    body = [f"<h1>Mémo — {escape(s['name'])}</h1>", f"<p><em>{escape(s.get('description') or '')}</em></p><ul>"]
    body += [f"<li><b>{escape(k)}</b> : {escape(str(v))}</li>" for k, v in profile] + ["</ul>"]
    for label, lines in sections:
        body.append(f"<h2>{escape(label)}</h2><ul>")
        body += [f'<li>{escape(t)} <a href="#src{n}">[{n}]</a></li>' for t, n in lines] or ["<li><em>Pas de donnée sourcée.</em></li>"]
        body.append("</ul>")
    body.append("<h2>Sources</h2><ol>")
    body += [f'<li id="src{i}"><a href="{escape(u)}">{escape(u)}</a> — récupéré le {d}</li>'
             for i, (u, d) in enumerate(sources, 1)]
    body.append("</ol>")
    style = ("body{font-family:system-ui,sans-serif;max-width:760px;margin:40px auto;padding:0 16px;"
             "line-height:1.5;color:#1d2433}h2{border-bottom:1px solid #ddd;padding-bottom:4px}a{color:#3b5bdb}")
    return (f"<!doctype html><html lang='fr'><head><meta charset='utf-8'><title>Mémo {escape(s['name'])}</title>"
            f"<style>{style}</style></head><body>{''.join(body)}</body></html>")
