# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## État du dépôt

- `docs/analyse-donnees.md` : l'analyse des sources (quoi brancher, quoi éviter, pourquoi). La relire avant d'ajouter une source.
- `scout/` : le prototype en TypeScript (Node 22+, ESM). Toutes les commandes se lancent depuis `scout/`.

## Commandes (`cd scout`)

```bash
npm install
npm run analyse -- avrea.com                    # fiche complète → out/avrea-com.html + .json
npm run analyse -- alan.com --collect-only      # identité + registres seulement, sans IA ni clé
npm run analyse -- alan.com --pods=snapshot,team
npm test                                        # vitest
npx vitest run test/evidence.test.ts -t "idempotent"   # un seul test
npm run typecheck
```

Variables (`scout/.env`, chargé automatiquement ; la liste complète des clés BYOK est dans `scout/src/sources/catalog.ts`) : `ANTHROPIC_API_KEY` est obligatoire hors `--collect-only`. Facultatives : `SCOUT_POD_MODEL` (par défaut `claude-sonnet-5-5`), `SCOUT_SYNTHESIS_MODEL` (par défaut `claude-opus-5-5`), `GITHUB_TOKEN`, `JINA_API_KEY`, `OPENALEX_API_KEY`, `COMPANIES_HOUSE_API_KEY`.

## Architecture du prototype

Le flux est `cli.ts` → `orchestrator.ts` → `identity.ts`, puis `agents.ts` × 6 pods en parallèle, puis la synthèse et `render.ts`.

- **`evidence.ts` est le cœur.** Chaque fait est une `Evidence` :
  - un id = hash du contenu (`ev_xxxxxxxxxxxx`) ;
  - `confidence` (`observed` / `derived` / `inferred`) et `authority` ;
  - `as_of` et `retrieved_at`, `limitations`, `derived_from`.

  Ce modèle est repris de `morluto/rea`. Le `Ledger` est partagé par tous les agents. `PodReport` exige au moins un `evidence_ids` par métrique.
- **`identity.ts` n'utilise pas d'IA.** Il lit le site, puis les mentions légales et la politique de confidentialité, et en extrait le SIREN, le HRB ou la raison sociale. Avec un SIREN, il interroge le registre INSEE/RNE et le BODACC. Il passe de la filiale à la maison mère quand le site cite une autre entité au même siège (cas d'alan.com). Les preuves obtenues sont injectées dans le dossier de chaque agent.
- **`sources/*.ts` : une fonction par source**, qui renvoie des `EvidenceInput[]` et n'appelle jamais de LLM. Pour ajouter une source :
  1. écrire la fonction dans `sources/` ;
  2. l'exposer comme outil dans `tools.ts` ;
  3. la déclarer dans `sources/catalog.ts`.
- **`tools.ts` : les outils `betaZodTool` des agents.** Les outils de collecte écrivent dans le registre et renvoient les ids au modèle. `submit_report` rejette les citations inconnues : le garde-fou est dans le code, pas dans le prompt.
- **`agents.ts`** : `POD_BRIEFS` décrit la mission de chaque pod, et le prompt système est commun. Points clés :
  - `runPod` utilise `client.beta.messages.toolRunner` avec l'outil serveur `web_search_20260209` ;
  - il relance les tours qui s'arrêtent en `pause_turn` ;
  - il signale toute URL citée que l'agent n'a jamais vue ;
  - `synthesize` utilise `messages.parse` avec un schéma Zod (bull case, bear case, signaux d'alerte, questions aux fondateurs).
  - Les modèles sont Opus 5.5 et Sonnet 5.5 : `tool_choice` forcé et `thinking.disabled` y renvoient une erreur 400. On pilote donc avec `output_config.effort` et le prompt.
- **`render.ts`** : une page HTML autonome où chaque chiffre est une pastille cliquable vers sa ligne du registre.

## Règles de données (issues de l'analyse)

- Pas de scraping de LinkedIn ni de rétro-ingénierie d'API privées (Harmonic, Welcome to the Jungle…). Les sources payantes passent par la clé du fonds (« BYOK », voir `sources/catalog.ts`).
- RGPD : des dirigeants, on ne garde que le nom et la fonction. Jamais la date de naissance.
- Un chiffre sans preuve n'entre pas dans un rapport. Ce qu'on ne trouve pas va dans `unknowns`.

## Le produit : « AI-native VC Analyst »

Un analyste VC AI-native pour les fonds early-stage européens (pre-seed à série A, 5 à 30 personnes). On colle une URL de startup, un pitch, un deck ou le LinkedIn d'un founder ; en quelques minutes on obtient un dashboard de diligence sourcé, un chat qui connaît la boîte et un deck prêt pour le comité.

Source de vérité produit : `AI-native VC Analyst — One-pager.md` (et sa version PDF), dans `~/Downloads/`. La relire avant toute décision produit.

### Modèle fonctionnel (à respecter dans l'architecture)

- **Interface de chat** type Claude/ChatGPT, où **chaque entreprise est un espace de travail persistant** (une « fiche »). Dès qu'un nom d'entreprise est détecté dans l'input, une nouvelle discussion s'ouvre et l'agent collecte les données.
- **Dashboard en pods**, un par axe d'analyse :
  - Snapshot : nom, site, LinkedIn, dernière série, total levé, investisseurs, FTE, funding par employé
  - Traction : croissance FTE, recherches web, abonnés LinkedIn, CA déposé si disponible
  - Team : parcours, écoles, entreprises précédentes, publications, brevets
  - Marché : sizing, dynamique, concurrents directs/indirects
  - Produit : ce qu'il fait, différenciation, maturité
  - ICP : client cible, cas d'usage, signaux clients
- **Chaque chiffre porte sa source, sa date et un niveau de confiance.** C'est une exigence de modèle de données, pas seulement d'affichage.
- **Suivi dans le temps** : la fiche se met à jour ; on stocke des séries temporelles (effectifs, abonnés, recherches), pas une photo unique.
- **Export** : deck comité généré depuis le dashboard.

### Partis pris techniques issus du one-pager

- **Ne pas construire une base d'entreprises.** On se branche sur l'existant (Harmonic, PitchBook, CRM) en mode *bring your own data* : le fonds connecte ses propres abonnements. Prévoir des connecteurs de sources interchangeables.
- **Couches différenciantes** :
  1. Registres européens officiels — en France Pappers et le BODACC (comptes, dirigeants, actionnaires, annonces légales), plus brevets et publications. Gérer le cas fréquent des comptes déposés en confidentialité.
  2. Signaux de traction alternatifs suivis dans le temps.
  3. « Jugement du fonds » : lecture via la thèse du fonds, bear case automatique, comparaison aux deals déjà vus / investis / refusés (mémoire des deals). Palier payant « Fonds ».
- **Offres** : Founder (gratuit, 1 fiche sur sa propre boîte), Analyste (fiches illimitées, chat, export deck), Fonds (thèse, mémoire des deals, bear case, intégration CRM). Les droits d'accès doivent pouvoir suivre ces paliers.

### Roadmap (critère de passage à chaque étape)

1. Valider le besoin — 15 entretiens analystes/associates.
2. Prototype sur données réelles — 10 fiches comparées aux notes des fonds.
3. MVP avec 3 fonds pilotes — fiche, pods, chat, export deck.
4. Couche jugement et monétisation.

Ne pas construire en avance les fonctionnalités d'une étape ultérieure.

## Référence concurrente : Harmonic Scout

`~/Downloads/Scout ｜ analyse de https：_avrea.com_pricing (22_10_2026 10：59：49).html` est une capture SingleFile d'un fil Harmonic Scout (analyse de la page tarifs d'Avrea). C'est le concurrent principal et le benchmark de qualité de sortie : réponse en français, étapes de recherche visibles (« Lecture de la page… », « Recherche du profil… »), synthèse en tête, tableaux comparatifs, et **citations de source en ligne après chaque affirmation**. Nos réponses doivent viser au moins ce niveau, avec en plus registres européens, bear case, mémoire des deals et export deck.

Fichier lourd (~685 Ko de CSS/HTML inline) : en extraire le texte plutôt que le lire en entier.
