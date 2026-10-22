# Cicero — analyse et suivi des textes

La direction artistique vient de [design.md](design.md). Le logo reprend les lettres, le point et la séquence du fichier [Cicero – Animation du logo.html](<Cicero – Animation du logo.html>), intégrés dans `frontend/logo.css` avec des classes isolées. Les deux fichiers de référence restent inchangés.

## Lancer

```sh
.venv/bin/python -m uvicorn backend.lexguard:app --host 127.0.0.1 --port 8000
```

- Accueil et nouvelle analyse : http://localhost:8000/#analyse
- Mes textes suivis : http://localhost:8000/#suivi
- Diagnostic de l'arrêté de santé : http://localhost:8000/#diagnostic/suivi-sante

Les pages utilisent des routes par fragment et le serveur existant. Le frontend n'appelle aucune API et ne modifie pas PostgreSQL. Aucun nouveau paquet n'est nécessaire.

## Parcours du pitch en quatre étapes

1. **Accueil Cicero** : les lettres apparaissent, le point cramoisi tombe et la baseline se révèle. Choisir « Données de santé » pour remplir le projet et sélectionner ses critères automatiquement.
2. **Analyse** : trois étapes sur environ 3,2 secondes. La barre en encre progresse et le compteur atteint 1 248 textes simulés. Le point cramoisi apparaît lorsqu'une détection est simulée. Le bouton « Passer l'animation » reste disponible.
3. **Diagnostic** : le projet d'arrêté est identifié avec sa référence. Cinq incohérences apparaissent : deux conflits, deux vides et un doublon. Chaque carte nomme la disposition examinée, le texte rapproché, sa date, son niveau et la raison de la détection. Ouvrir la première carte : « cinq ans » dans le projet d'arrêté contre « vingt ans » dans le décret fictif. Les passages se surlignent, une courbe les relie, l'analyse s'écrit et une correction est proposée. Copier puis marquer comme traité.
4. **Textes suivis** : retrouver l'arrêté et le nombre d'alertes restant à traiter. Les nouveaux signaux se distinguent des alertes déjà consultées. Rechercher un texte, filtrer les projets avec alertes, ou ajouter un texte pour lancer sa première analyse.

## Pages et comportements

### Analyse et diagnostic

Le contexte identifie le texte examiné, son niveau de norme, sa référence et son statut. Les textes de démonstration déjà connus sont reliés au suivi. Une analyse libre peut être ajoutée au suivi via « Suivre ce texte ». Le diagnostic d'un texte suivi ne mélange pas ses détections avec celles d'autres dossiers ; le texte sans alerte conserve un état vide réel.

Les filtres se cumulent entre catégories ; plusieurs choix d'une catégorie sont réunis. Niveaux et sources portent sur au moins un des textes comparés. La période porte sur la date du texte examiné, avec une horloge de démonstration fixée au 22 octobre 2026. La période personnalisée accepte des bornes inclusives. Les mots-clés sont séparés par des virgules, sans distinction de casse ou d'accents. L'interprétation de la demande reste déterministe et limitée aux trois thèmes disponibles.

### Mes textes suivis

Quatre dossiers sont préchargés : santé, temps de travail, urbanisme et un arrêté de procédure sans alerte. Trois dossiers ont des alertes, six signaux sont initialement nouveaux. La page propose recherche, filtres, statuts, références, dernière vérification et accès au diagnostic.

Ouvrir le diagnostic marque les nouveaux signaux du dossier comme consultés, sans les déclarer traités. « Marquer comme traité » retire la détection du compteur d'alertes à traiter et grise la carte ; le résultat reste consultable. Les badges de navigation et les indicateurs du suivi reflètent ces changements.

« Ajouter un texte » recueille titre, niveau, domaine, référence facultative et demande à vérifier. Le texte est ajouté à la session et l'analyse fictive démarre. Le formulaire n'envoie rien à un serveur.

## Design et accessibilité

Papier `#F8F7F4`, surfaces blanches, encre et Newsreader. L'action principale est en Encre profonde. Le cramoisi reste réservé au logo, au focus et aux détections. Chaque type combine icône, libellé et variantes de couleur lisibles. Les palettes et tailles sont définies en variables dans `frontend/style.css`, avec mapping optionnel dans `frontend/tailwind.config.cjs`.

La stack reste HTML/CSS/JavaScript native : popovers recherchables, dialogues latéraux, tiroir mobile et toast. Pas d'ajout de React/shadcn/Framer Motion. Les fonctions équivalentes utilisent les éléments natifs, CSS et Web Animations API. Inter, Newsreader et Geist Mono sont facultatives, avec repli système.

Sur mobile : navigation adaptée, options en dialogue plein écran avec « Appliquer », bouton Analyser fixe, comparaison en colonnes empilées. Ctrl/⌘ + Entrée lance l'analyse ; Échap ferme les panneaux. Les popovers sont utilisables au clavier. `prefers-reduced-motion` supprime les déplacements et rend logo, compteurs, exemples et explication immédiatement lisibles.

Le bouton d'aide permet de simuler une erreur ou aucun résultat au prochain lancement, ainsi que de rejouer le logo.

## Fichiers

- `frontend/index.html` : pages et dialogues.
- `frontend/style.css`, `frontend/logo.css`, `frontend/tracking.css` : thème, animation fournie, diagnostic et suivi.
- `frontend/app.js` : analyse, filtres, animation, comparaison, correction et traitements.
- `frontend/tracking.js` : contexte du diagnostic, navigation, suivi et ajout d'un texte.
- `frontend/mocks/analysis.js` : onze incohérences fictives, dont les cinq scénarios santé de design.md et six scénarios des deux autres thèmes.
- `frontend/mocks/tracking.js` : dossiers suivis et calcul des compteurs/recherche.
- `tests/test_demo_filters.cjs`, `tests/test_tracking.cjs` : scénarios et logique de suivi.

## Vérifications

```sh
node --test tests/*.cjs
.venv/bin/python -m unittest discover -s tests
node --check frontend/app.js
node --check frontend/tracking.js
```

Les parcours Chrome vérifient logo, analyse, cinq résultats santé, comparaison 5/20 ans, courbe entre les passages, copie et traitement, filtres, états secondaires, navigation suivi/diagnostic, alertes consultées, ajout/analyse, mobile et absence d'appels API.

## Limites assumées

Toutes les références, citations, corrections et conclusions sont fictives, y compris lorsqu'un nom de code juridique réel apparaît. Aucun diagnostic n'a valeur d'avis juridique. Les agents et compteurs sont simulés. Les ajouts, traitements et historiques durent uniquement pendant la session et disparaissent au rechargement. La même détection de démonstration réutilisée dans plusieurs dossiers partage son statut de traitement ; il ne s'agit pas d'une gestion réelle de dossiers distincts. La veille n'est pas exécutée en arrière-plan et aucune notification externe n'est envoyée.

Avant le pitch, vérifier le zoom, la lisibilité et le contraste sur le projecteur réel. Le branchement d'un corpus véritable et la validation juridique sont des étapes ultérieures.
