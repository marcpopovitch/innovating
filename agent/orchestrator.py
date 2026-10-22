"""Orchestrateur : lance un sous-agent par pod, en parallèle, puis assemble le dashboard."""
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta

from agent import sources
from agent.pods import POD_LABELS, run_pod
from backend import db
from backend.config import FACT_MAX_AGE_DAYS


def _is_fresh(facts: list[dict]) -> bool:
    limit = db.now() - timedelta(days=FACT_MAX_AGE_DAYS)
    return bool(facts) and all(f["fetched_at"] >= limit for f in facts)


def dashboard(startup_id: str, errors: dict | None = None) -> dict:
    startup = db.get_startup(startup_id)
    facts = db.get_facts(startup_id)
    return {
        "startup": startup,
        "pods": {
            pod: {"label": label, "facts": [f for f in facts if f["pod"] == pod]}
            for pod, label in POD_LABELS.items()
        },
        "errors": errors or {},
    }


def analyze(startup_id: str, refresh: bool = False) -> dict:
    startup = db.get_startup(startup_id)
    if not startup:
        raise KeyError(startup_id)

    # Seuls les pods vides ou trop anciens sont relancés (sauf refresh=True).
    todo = [p for p in POD_LABELS if refresh or not _is_fresh(db.get_facts(startup_id, p))]

    def safe_run(pod: str):
        try:
            run_pod(startup, pod)
            return None
        except Exception as e:
            return f"{type(e).__name__}: {e}"

    with ThreadPoolExecutor(max_workers=4) as ex:
        results = dict(zip(todo, ex.map(safe_run, todo)))
    return dashboard(startup_id, {pod: err for pod, err in results.items() if err})


def resolve(url: str) -> dict:
    """URL de site, page LinkedIn d'entreprise ou LinkedIn de founder -> startup en base."""
    url = url.strip()
    is_linkedin = "linkedin.com" in url
    for s in db.list_startups():
        if is_linkedin and s.get("linkedin_url") and s["linkedin_url"].rstrip("/") == url.rstrip("/"):
            return s
        if not is_linkedin and s.get("website") and sources.domain_of(s["website"]) == sources.domain_of(url):
            return s

    try:
        if "linkedin.com/in/" in url:  # profil de founder -> son entreprise actuelle
            company = sources.harmonic_company_of_person(url)
        else:
            company = sources.harmonic_enrich(url)
        startup = sources.normalize_company(company)
    except Exception as e:
        print(f"[resolve] Harmonic indisponible ({e}), fiche minimale créée")
        slug = url.rstrip("/").split("/")[-1] if is_linkedin else sources.domain_of(url)
        startup = {
            "id": f"dom:{slug}",
            "name": slug.split(".")[0].replace("-", " ").title(),
            "website": None if is_linkedin else url,
            "linkedin_url": url if is_linkedin else None,
            "sector": "Non classé",
            "data_source": "url",
        }
    db.upsert_startup(startup)
    return db.get_startup(startup["id"])
