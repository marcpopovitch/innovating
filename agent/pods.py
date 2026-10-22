"""Un sous-agent par pod : base -> web si besoin -> faits sourcés -> base."""
from agent.llm import run_agent
from agent.tools import Toolbox
from backend import db

POD_LABELS = {"market": "Marché", "team": "Équipe", "product": "Produit", "icp": "ICP"}

POD_SCOPE = {
    "market": "taille et croissance du marché, tendances, principaux concurrents et positionnement",
    "team": "fondateurs (noms, rôles, parcours), taille de l'équipe, recrutements clés, investisseurs",
    "product": "ce que fait le produit, technologie, différenciation, pricing, traction publique "
               "(clients, levées de fonds, chiffres)",
    "icp": "client idéal : segment, taille d'entreprise, persona acheteur, secteurs et zones ciblés, cas d'usage",
}

TOOLS = ["get_startup_profile", "get_stored_facts", "search_knowledge", "web_search", "save_fact"]

SYSTEM = """Tu es un analyste VC rigoureux. Tu remplis la section « {label} » du dossier sur {name}.
Sujet de la section : {scope}.

Méthode :
1. get_startup_profile, puis search_knowledge pour voir ce qui est déjà en base.
2. S'il manque des informations importantes, fais 2 à 4 web_search ciblées
   (nom de la startup + sujet).
3. Enregistre 4 à 8 faits avec save_fact : une phrase courte, factuelle et autonome
   par fait, en français, avec l'URL exacte de la source.

Règles :
- Uniquement ce qui est écrit dans un résultat d'outil. Jamais de chiffre ou de nom de mémoire.
- Si une source parle d'une autre entreprise au nom proche, ignore-la.
- Si tu ne trouves rien de fiable, n'enregistre rien et dis-le.
Termine par une phrase de résumé."""


def run_pod(startup: dict, pod: str) -> str:
    db.delete_facts(startup["id"], pod)  # on régénère le pod (les textes en base restent réutilisables)
    box = Toolbox(startup, pod)
    system = SYSTEM.format(label=POD_LABELS[pod], name=startup["name"], scope=POD_SCOPE[pod])
    prompt = f"Startup : {startup['name']} ({startup.get('website') or 'site inconnu'}). Remplis la section."
    return run_agent(system, prompt, box.definitions(TOOLS), box.handlers(TOOLS))
