"""Projets de texte de démo + script de lancement.

    python -m tests.demo_drafts                 # les 3 projets, pipeline complet
    python -m tests.demo_drafts vitesse_30      # un seul projet
    python -m tests.demo_drafts --step1         # étape 1 : extracteur + recherche + juge (sans chercheur)
"""
import asyncio
import json
import sys
import time

DRAFTS = {
    # Conflit évident : la définition des EDPM plafonne la vitesse par construction à 25 km/h.
    "vitesse_30": """Projet de décret relatif à la vitesse des engins de déplacement personnel motorisés.
Article 1er : La vitesse maximale par construction des engins de déplacement personnel motorisés
est fixée à 30 km/h.
Article 2 : Le ministre de l'intérieur est chargé de l'exécution du présent décret.""",

    # Doublon : le code de la route et l'arrêté de Garches prévoient déjà ces règles.
    "doublon_garches": """Projet d'arrêté municipal de la commune de Garches.
Article 1er : Les engins de déplacement personnel motorisés ne peuvent transporter qu'un conducteur.
Article 2 : Le port du casque et du gilet de haute visibilité de couleur jaune fluo est obligatoire
pour toute personne circulant en engin de déplacement personnel motorisé sur le territoire de la commune.""",

    # Vide : aucun texte de la base ne traite de l'assurance ni des données des opérateurs.
    "vide_operateurs": """Projet d'arrêté relatif aux trottinettes électriques en libre-service.
Article 1er : Les opérateurs de trottinettes électriques en libre-service transmettent chaque mois
à la mairie les données anonymisées de trajets de leurs engins.
Article 2 : Tout manquement est puni de l'amende prévue pour les contraventions de la 4e classe.""",
}


def show(result: dict) -> None:
    for f in result["findings"]:
        print(f"\n[{f['type'].upper()}] ({f['confidence']:.2f}) {f['obligation']}")
        print(f"  {f['explanation']}")
        for c in f["citations"]:
            print(f"  -> {c['ref']} ({c['version_date']})")
    print(f"\nRésumé : {result['summary']}")
    print(f"Citations rejetées par le garde-fou : {result['rejected_citations']}")
    print("Étapes : " + " | ".join(f"{s['agent']} {s['ms']} ms" for s in result["steps"]))


async def step1(draft: str) -> None:
    """Extracteur -> search_articles (sur le texte de l'obligation) -> juge -> garde-fou."""
    from agents.extractor import extract
    from agents.judge import judge
    from agents.search import search_articles
    from agents.validation import validate

    obligations = await extract(draft)
    print(f"{len(obligations)} obligation(s) extraite(s)")
    for ob in obligations:
        print("\n" + json.dumps(ob.model_dump(), ensure_ascii=False))
        articles = search_articles(f"{ob.sujet} {ob.action} {ob.valeur or ''}")
        print(f"  {len(articles)} article(s) trouvé(s) : {[a['ref'] for a in articles]}")
        verdict, rejected = validate(await judge(ob, articles[:5]), articles)
        print(f"  => {verdict.type.upper()} ({verdict.confidence}) : {verdict.explanation}")
        print(f"  citations : {[c.ref for c in verdict.citations]} | rejetées : {rejected}")


async def main(args: list[str]) -> None:
    if "--step1" in args:
        await step1(DRAFTS["vitesse_30"])
        return
    from agents.orchestrator import check

    for name in [a for a in args if a in DRAFTS] or DRAFTS:
        print(f"\n{'=' * 70}\n{name}\n{'=' * 70}")
        t0 = time.monotonic()
        show(await check(DRAFTS[name]))
        print(f"Durée totale : {time.monotonic() - t0:.1f} s")


if __name__ == "__main__":
    asyncio.run(main(sys.argv[1:]))
