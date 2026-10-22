"""Orchestrateur : extracteur -> (chercheur + juge) en parallèle par obligation -> rapporteur.

Renvoie exactement le format attendu par le front :
{"findings": [{"obligation", "type", "explanation", "citations", "confidence"}],
 "summary", "steps": [{"agent", "action", "ms"}], "rejected_citations"}
"""
import asyncio
import time

from agents.config import TIMEOUT_S
from agents.extractor import extract
from agents.judge import judge
from agents.reporter import report
from agents.researcher import research
from agents.schemas import Obligation
from agents.validation import validate

MAX_OBLIGATIONS = 8
REPORTER_BUDGET_S = 12  # temps gardé pour le rapporteur à la fin
ORDER = {"conflit": 0, "doublon": 1, "vide": 2, "compatible": 3}


def _ms(start: float) -> int:
    return int((time.monotonic() - start) * 1000)


def _label(ob: Obligation) -> str:
    """Libellé lisible et propre à chaque règle (une même phrase peut contenir plusieurs règles)."""
    return f"{ob.sujet} : {ob.action}" + (f" ({ob.valeur})" if ob.valeur not in (None, "") else "")


def _dedupe(obligations: list[Obligation]) -> list[Obligation]:
    seen, out = set(), []
    for ob in obligations:
        key = _label(ob).lower()
        if key not in seen:
            seen.add(key)
            out.append(ob)
    return out


def _fallback_summary(findings: list[dict]) -> str:
    counts = {t: sum(f["type"] == t for f in findings) for t in ORDER}
    return (f"{counts['conflit']} conflit(s), {counts['doublon']} doublon(s), {counts['vide']} vide(s) "
            f"et {counts['compatible']} obligation(s) compatible(s) détectés.")


async def check(draft_text: str) -> dict:
    deadline = time.monotonic() + TIMEOUT_S
    steps: list[dict] = []
    rejected_total = 0

    t = time.monotonic()
    obligations = _dedupe(await asyncio.wait_for(extract(draft_text), timeout=TIMEOUT_S))[:MAX_OBLIGATIONS]
    steps.append({"agent": "extractor", "action": f"{len(obligations)} obligation(s) extraite(s)", "ms": _ms(t)})

    async def analyse(ob: Obligation) -> dict:
        nonlocal rejected_total
        t = time.monotonic()
        selected, returned = await research(ob)
        steps.append({"agent": "researcher",
                      "action": f"{len(selected)} article(s) retenu(s) pour « {ob.sujet} »", "ms": _ms(t)})
        t = time.monotonic()
        verdict, rejected = validate(await judge(ob, selected), returned)
        rejected_total += rejected
        steps.append({"agent": "judge",
                      "action": f"{verdict.type} ({verdict.confidence:.2f}) pour « {ob.sujet} »"
                                + (f", {rejected} citation(s) rejetée(s)" if rejected else ""), "ms": _ms(t)})
        return {"obligation": _label(ob), "type": verdict.type, "explanation": verdict.explanation,
                "citations": [c.model_dump() for c in verdict.citations], "confidence": verdict.confidence}

    tasks = [asyncio.create_task(analyse(ob)) for ob in obligations]
    findings = []
    if tasks:
        budget = max(1.0, deadline - time.monotonic() - REPORTER_BUDGET_S)
        done, pending = await asyncio.wait(tasks, timeout=budget)
        for task in pending:
            task.cancel()
        for ob, task in zip(obligations, tasks):
            if task in done and task.exception() is None:
                findings.append(task.result())
            else:
                reason = "délai dépassé" if task in pending else f"erreur : {task.exception()}"
                steps.append({"agent": "orchestrator", "action": f"« {ob.sujet} » non analysée ({reason})", "ms": 0})
                findings.append({"obligation": _label(ob), "type": "vide", "citations": [], "confidence": 0.0,
                                 "explanation": f"Analyse non terminée ({reason}) : à vérifier manuellement."})
    findings.sort(key=lambda f: ORDER[f["type"]])

    t = time.monotonic()
    try:
        remaining = max(1.0, deadline - time.monotonic())
        summary = await asyncio.wait_for(report(findings), timeout=remaining) if findings else \
            "Aucune obligation vérifiable n'a été trouvée dans le projet."
        steps.append({"agent": "reporter", "action": "résumé rédigé", "ms": _ms(t)})
    except Exception as e:
        summary = _fallback_summary(findings)
        steps.append({"agent": "reporter", "action": f"résumé de secours ({type(e).__name__})", "ms": _ms(t)})

    return {"findings": findings, "summary": summary, "steps": steps, "rejected_citations": rejected_total}
