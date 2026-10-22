"""Compare « Claude seul » et « notre analyste » sur eval/cases.json.

    python -m eval.run_eval              # les deux, tous les cas
    python -m eval.run_eval --limit 3    # pour tester vite

Trois taux par système :
- correctes : bonne réponse (ou, pour les cas "UNKNOWN", le système dit qu'il ne sait pas)
- sourcées  : la réponse contient au moins une URL
- inventées : ni correcte ni « je ne sais pas » -> réponse fausse affirmée
"""
import argparse
import json
import re
import unicodedata
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from agent.chat import chat
from agent.llm import ask, text_of
from backend import db

HERE = Path(__file__).parent
# Appliquée au texte normalisé (minuscules, sans accents).
ABSTAIN = re.compile(
    r"je ne sais pas|pas d'information|aucune information|pas trouve|introuvable|n'est pas (disponible|public)"
    r"|i don't know|i do not know|no information|not (publicly )?(available|disclosed)|could ?n[o']t find"
    r"|unable to find|not found|no reliable", re.I)


def norm(s: str) -> str:
    s = s.replace("’", "'")  # apostrophe typographique
    return unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()


def grade(case: dict, answer: str) -> dict:
    abstained = bool(ABSTAIN.search(norm(answer)))
    text = norm(answer)
    if case.get("expected") == "UNKNOWN":
        correct = abstained
    elif "expected_all" in case:
        correct = all(norm(k) in text for k in case["expected_all"])
    else:
        correct = any(norm(k) in text for k in case["expected_any"])
    return {"correct": correct, "sourced": "http" in answer, "invented": not correct and not abstained}


def claude_alone(case: dict) -> str:
    response = ask("You are a helpful assistant for venture capital associates.",
                   [{"role": "user", "content": case["question"]}])
    return text_of(response)


def our_analyst(case: dict) -> str:
    return chat(case["startup_id"], case["question"])["answer"]


def run(system_fn, cases: list[dict]) -> list[dict]:
    def one(case):
        try:
            answer = system_fn(case)
        except Exception as e:
            answer = f"ERREUR : {e}"
        return {"id": case["id"], "answer": answer, **grade(case, answer)}

    with ThreadPoolExecutor(max_workers=4) as ex:
        return list(ex.map(one, cases))


def rates(results: list[dict]) -> dict:
    n = len(results) or 1
    return {k: round(100 * sum(r[k] for r in results) / n) for k in ("correct", "sourced", "invented")}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int)
    args = parser.parse_args()

    cases = json.loads((HERE / "cases.json").read_text(encoding="utf-8"))[: args.limit]
    missing = [c["startup_id"] for c in cases if not db.get_startup(c["startup_id"])]
    if missing:
        raise SystemExit(f"Startups absentes de la base : {missing} (charger l'échantillon)")

    report = {}
    for name, fn in (("Claude seul", claude_alone), ("Notre analyste", our_analyst)):
        print(f"→ {name}…")
        results = run(fn, cases)
        report[name] = {"rates": rates(results), "results": results}

    print(f"\n{'Système':<16}{'Correctes':>11}{'Sourcées':>10}{'Inventées':>11}   ({len(cases)} cas)")
    for name, r in report.items():
        x = r["rates"]
        print(f"{name:<16}{x['correct']:>10}%{x['sourced']:>9}%{x['invented']:>10}%")
    out = HERE / "results.json"
    out.write_text(json.dumps(report, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"\nDétail : {out}")


if __name__ == "__main__":
    main()
