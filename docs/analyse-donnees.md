# Où trouver les données d'une startup, et comment les récupérer

*Analyse du 22 octobre 2026. Elle prend Harmonic comme référence ; les constats sur Alan et Avrea viennent de tests réels sur leurs sites.*

## En une minute

- **On ne reconstruit pas Harmonic.** Sa base (40 M d'entreprises, LinkedIn, fonds partenaires) coûte 36 à 84 k$/an et ne se scrape pas : c'est contraire à ses CGU, et sa donnée est de toute façon payante. On la branche avec **la clé du fonds** (« bring your own key »).
- **Ce qu'Harmonic fait mal, et nous bien :** les **registres légaux européens** (comptes déposés, dirigeants, capital, annonces légales), qu'Harmonic n'expose pas ; une **citation vérifiable pour chaque chiffre** ; et une lecture « comité » avec bear case.
- **En France, tout le socle légal est gratuit :** API Recherche d'entreprises (INSEE et RNE), BODACC, INPI. Le BODACC publie chaque **augmentation de capital**, souvent le signe d'une levée, avant même que la presse en parle.
- **Le site de la boîte fait le lien entre le web et les registres.** La loi oblige à afficher le SIREN (France), le HRB (Allemagne) ou la raison sociale. On peut les lire automatiquement, sans IA.
- **Il ne faut jamais scraper LinkedIn.** Proxycurl a fermé en juillet 2025 après une action en justice de LinkedIn. Pour les parcours : presse, site, People Data Labs.
- **Un sous-agent IA par axe d'analyse,** les six en parallèle. Ils partagent un **registre de preuves**, repris du modèle de [`morluto/rea`](https://github.com/morluto/rea). Un chiffre sans preuve est **refusé** par le code, pas seulement déconseillé dans le prompt.

## 1. Harmonic : la référence à battre

| | Harmonic | Notre angle |
|---|---|---|
| Données | Crawl web, LinkedIn (profils non publics), registres non précisés, données envoyées par des fonds et accélérateurs partenaires | Registres officiels européens d'abord, puis le web, puis la clé Harmonic/Dealroom du fonds |
| Fraîcheur | Effectif chaque semaine, trafic chaque mois ; aucun engagement de délai hors startups financées | Collecte à la demande et suivi dans le temps (séries, pas photos) |
| Champs forts | `traction_metrics` sur 14 à 365 jours (effectif par département, trafic, abonnés), highlights, investisseurs | Comptes, capital, dirigeants, annonces légales, offres d'emploi, historique du site |
| API | REST + GraphQL, en-tête `apikey`, environ 10 req/s, MCP officiel (`mcp.api.harmonic.ai`) | Connecteur BYOK avec la clé du fonds |
| Scout (leur agent) | LangGraph, recherche en langage naturel, rapports de diligence, Scouts planifiés | Même expérience, mais **chaque chiffre est cliquable vers sa source** et un bear case est produit automatiquement |
| Angles morts | Petites boîtes européennes, données légales (aucun champ bilan ni bénéficiaire effectif), chiffres de taille de base incohérents d'une page à l'autre | C'est notre terrain |

La capture Scout de la page tarifs d'Avrea fixe le niveau attendu : étapes de recherche visibles, synthèse en tête, tableaux, citation en ligne. Notre fiche doit reprendre ces codes et y ajouter le registre de preuves complet.

## 2. Les sources, axe par axe

Légende : ✅ à brancher en V1 · 🔑 avec la clé du fonds · ⏳ plus tard · ⛔ à éviter.

### Snapshot (identité, levées, effectif)

| Source | Accès | Prix | Qualité | Verdict |
|---|---|---|---|---|
| [API Recherche d'entreprises](https://recherche-entreprises.api.gouv.fr/docs) (INSEE + RNE) | API officielle, sans clé, environ 7 req/s | Gratuit | ★★★ | ✅ Identité, dirigeants, tranche d'effectif, comptes publiés |
| [BODACC](https://bodacc-datadila.opendatasoft.com) | API OpenDataSoft | Gratuit | ★★★ | ✅ Augmentations de capital (avec montant du capital), cessions, procédures collectives |
| Mentions légales / Impressum du site | Lecture de la page | Gratuit | ★★★ | ✅ SIREN, HRB, raison sociale : la jointure web ↔ registre |
| [INPI RNE](https://www.inpi.fr/acces-aux-api-et-ftp-data-inpi) | API avec compte | Gratuit | ★★★ | ⏳ Actes et comptes en PDF (statuts, capital détaillé) |
| [Companies House](https://developer.company-information.service.gov.uk) (UK) | API, clé gratuite | Gratuit | ★★★ | 🔑 Connecteur prêt, activé par `COMPANIES_HOUSE_API_KEY` |
| [North Data](https://northdata.de/_data) (DE et UE) | API | 0,05 à 0,10 €/appel | ★★★ | ⏳ Handelsregister allemand |
| Pappers | API payante | Jetons | ★★★ | 🔑 Même donnée que les API publiques, mieux packagée |
| Dealroom | API sur devis | ~12,5 k€/an et plus | ★★★ sur l'Europe | 🔑 Meilleure couverture des levées européennes |
| Harmonic | API sur devis | 36 à 84 k$/an | ★★★ | 🔑 Effectif hebdomadaire, trafic, investisseurs |
| Crunchbase | Licence entreprise | ~20 k$/an | ★★ en Europe early-stage | ⏳ |
| OpenCorporates | API | 2 250 £/an pour 500 appels/mois | ★★ | ⛔ Trop cher par appel |

### Traction

| Source | Accès | Prix | Qualité | Verdict |
|---|---|---|---|---|
| Offres d'emploi : Ashby, Greenhouse, Lever, Workable | Endpoints JSON publics des pages carrières | Gratuit | ★★★ | ✅ Rythme et nature des recrutements |
| [Wayback Machine CDX](https://archive.org/developers) | API ouverte | Gratuit | ★★ | ✅ Ancienneté du site, anciennes versions du pricing |
| [GitHub](https://docs.github.com/rest) | API officielle | Gratuit | ★★★ | ✅ Activité open source |
| Google Trends | API officielle en alpha, sur candidature | — | ★★ | ⏳ **Candidater dès maintenant.** pytrends ne fonctionne plus (⛔) |
| Similarweb | Sur devis | ~100 k$/an | ★★★ | ⛔ en V1 ; DataForSEO comme alternative |
| Coresignal | API à crédits | 49 $ à 1 k$/mois | ★★ | ⏳ Courbes d'effectif sans LinkedIn |
| App stores, Product Hunt, Trustpilot | API ou lecture légère | Faible | ★★ | ⏳ |

### Team

| Source | Accès | Prix | Qualité | Verdict |
|---|---|---|---|---|
| Dirigeants du registre | API Recherche d'entreprises | Gratuit | ★★★ | ✅ Noms et fonctions officiels (sans date de naissance : minimisation RGPD) |
| Page équipe / about du site + presse | Lecture de page + recherche web | Gratuit | ★★ | ✅ |
| [OpenAlex](https://docs.openalex.org) | API ouverte | Gratuit | ★★★ | ✅ Publications des fondateurs deeptech |
| [EPO OPS](https://www.epo.org/en/searching-for-patents/data/web-services/ops) | API, inscription | Gratuit jusqu'à 4 Go/semaine | ★★★ | 🔑 Brevets européens |
| [People Data Labs](https://docs.peopledatalabs.com) | API | À partir de 98 $/mois | ★★ | 🔑 Parcours sans scraper LinkedIn |
| PatentsView (USPTO) | API en pause depuis mars 2026 | — | ★ | ⛔ Pour l'instant |
| **Scraping LinkedIn** (Proxycurl, Bright Data, Apify) | Interdit par les CGU | — | — | ⛔ **Jamais** : injonction obtenue contre Proxycurl en 2025, risque RGPD |

### Marché, Produit, ICP

| Source | Accès | Prix | Qualité | Verdict |
|---|---|---|---|---|
| Recherche web de Claude (`web_search`) | Intégrée à l'API | ~10 $ / 1 000 recherches | ★★★ | ✅ La plus simple, l'agent tournant déjà sur Claude |
| Site de la boîte via [Jina Reader](https://jina.ai/reader) | API de lecture | Gratuit avec limite | ★★★ | ✅ Rend le JavaScript ; repli sur le HTML brut |
| [Exa](https://exa.ai/docs) | API de recherche sémantique | ~7 $ / 1 000 requêtes | ★★★ | ⏳ Pour trouver des concurrents « qui ressemblent à » |
| Firecrawl | Crawl de sites entiers | ~16 à 20 $/mois | ★★★ | ⏳ Quand on voudra crawler tout un site |
| Flux Maddyness / Sifted / FrenchWeb | RSS + extraction par LLM | Gratuit | ★★ | ⏳ Base de levées FR maison, construite au fil de l'eau |

## 3. Comment ça marche : identité, puis sous-agents, puis synthèse

```
URL ──► Étape 0 · identité (sans IA)
        site → mentions légales → SIREN / HRB / raison sociale
        SIREN → registre INSEE/RNE + BODACC          ──► registre de preuves
                     │
                     ▼
        6 sous-agents en parallèle (Claude Sonnet 5.5)
        Snapshot · Traction · Team · Marché · Produit · ICP
        même boîte à outils, mission différente      ──► registre de preuves
                     │  chaque rapport : métriques → ids de preuve
                     ▼
        Synthèse (Claude Opus 5.5) : verdict, bull case,
        bear case, signaux d'alerte, questions aux fondateurs
                     │
                     ▼
        out/<boîte>.html : fiche cliquable + registre des preuves
```

**Pourquoi l'étape 0 n'utilise pas d'IA.** Le site affiche ses identifiants légaux par obligation. Les lire est déterministe, gratuit et sûr. Les agents reçoivent donc dès le départ des faits officiels qu'ils peuvent citer.

**Les outils des sous-agents** :

| Outil | Ce qu'il fait |
|---|---|
| `registry_search`, `registry_lookup`, `bodacc`, `companies_house` | Registres légaux |
| `read_page` | Lit n'importe quelle page, archives Wayback comprises |
| `wayback`, `jobs`, `github`, `openalex` | Signaux publics |
| `web_search` | Recherche web côté serveur Anthropic, 5 maximum par agent |
| `record_evidence` | Enregistre un fait trouvé sur le web, ou un calcul (avec ses preuves sources) |
| `submit_report` | Rend le rapport ; **refusé si une citation n'existe pas** |

**Les garde-fous contre les hallucinations,** dans le code et non dans le prompt :

1. Chaque métrique doit citer au moins une preuve. Une citation inconnue fait rejeter le rapport, et l'agent doit le corriger.
2. Un fait « observé » exige une URL. Un fait « calculé » exige ses preuves sources (`derived_from`).
3. Après chaque agent, toute URL citée qu'il n'a jamais lue ni reçue de la recherche web est **signalée** dans le registre.
4. La synthèse ne voit que les rapports et le registre, sans connaissance extérieure.

## 4. Le modèle de preuve, repris de REA

[`morluto/rea`](https://github.com/morluto/rea) n'est **pas** un outil de scraping. C'est un serveur MCP de rétro-ingénierie de logiciels. Son modèle de preuve (`src/domain/evidence.ts`) est en revanche exactement ce qu'il faut à un analyste. On l'a transposé :

| REA | Scout | Pourquoi |
|---|---|---|
| `evidence_id` = hash du contenu | `ev_` + SHA-256 du fait | Même fait = même id ; deux agents qui trouvent la même chose ne créent pas de doublon |
| `confidence` : observed / derived / inferred | Identique | Ne jamais présenter une estimation comme un fait |
| `authority` | registre-officiel / site-entreprise / donnée-publique / web / inférence-analyste | Un chiffre du greffe ne pèse pas comme un chiffre de blog |
| `limitations` | Identique | Ex. « tranche INSEE en retard d'un à deux ans » |
| `evidence_links` | `derived_from` | Un calcul (funding par employé) pointe vers ses entrées |
| Registre des inconnues | `unknowns` dans chaque pod | « Non trouvé » est une information pour le comité |
| *(absent)* | `retrieved_at` + `as_of` | Date de collecte et date de validité, indispensables pour suivre une boîte dans le temps |

## 5. Risques et limites

- **Comptes confidentiels.** Beaucoup de jeunes sociétés françaises déposent leurs comptes en confidentialité. Il faut l'indiquer comme limite au lieu de conclure « pas de CA ».
- **Holding ou filiale.** Sur alan.com, le SIREN affiché est celui d'Alan Insurance, la filiale d'assurance. Le site cite aussi « Alan SA ». On trouve dans le registre la société ALAN (SIREN 818 353 070) au **même siège** et la retient comme entité principale probable. C'est une preuve « déduite », dont le lien capitalistique reste à vérifier.
- **Hors de France.** Le site d'Avrea cite **deux** raisons sociales : « Avrea Ltd » dans la politique de confidentialité et « Avrea Oy » (forme finlandaise) dans les CGU. Harmonic Scout, lui, la situe à Berlin. Il faut garder les deux mentions comme preuves ; c'est exactement le genre d'écart qu'un comité veut voir. Il faudra un connecteur au registre finlandais (PRH, gratuit) pour trancher.
- **RGPD.** On ne garde des dirigeants que le nom et la fonction. Pas de scraping de profils personnels.
- **CGU.** Pas de rétro-ingénierie des API privées (Harmonic, LinkedIn, Welcome to the Jungle). On n'utilise que des API officielles, des endpoints publics prévus pour être lus, ou les clés du client.
- **Coût d'une fiche.** Environ 6 agents × 5 recherches web, plus les tokens Sonnet, plus une synthèse Opus : quelques dizaines de centimes à 1 € par fiche. À mesurer sur 20 boîtes réelles.

## 6. Prochaines étapes

1. Faire tourner la nouvelle version sur les 10 boîtes de l'étape 2 de la roadmap et comparer les résultats aux notes des fonds.
2. Brancher Companies House, North Data et le registre finlandais PRH (API ouverte) pour couvrir le Royaume-Uni, l'Allemagne et les pays nordiques.
3. Stocker les preuves dans une base et relancer la collecte chaque semaine, pour obtenir des **séries** : effectif, offres d'emploi, capital.
4. Candidater à l'API Google Trends.
5. Brancher un connecteur BYOK Harmonic via son MCP officiel pour un premier fonds pilote.
