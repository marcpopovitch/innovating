# Cicero : spécification de design

Outil qui détecte les contradictions entre textes de loi avant leur publication.  
**Contexte :** démo de hackathon de 2 minutes. Front-end uniquement, backend mocké.  
*Ce fichier est la source de vérité du design. En cas de doute : on retire.*

---

## 1. Principes

1. **Une page, une action.** Poser une question ou coller un texte, obtenir les contradictions.
2. **Le rouge est un signal, pas une décoration.** Le point rouge du logo représente la contradiction repérée. Le rouge n'apparaît que quand l'outil trouve quelque chose.
3. **Calme et précis.** Beaucoup d'espace, peu de couleurs, l'IA parle peu.
4. **Un seul moment wow :** l'animation d'analyse, puis les deux textes qui se contredisent avec le passage surligné.
5. **Lisible sur projecteur.** Grands textes, fort contraste, fond clair.
6. **Tout en français**, vocabulaire juridique exact.

---

## 2. Identité

### Logo
- Wordmark **« Cicero »** en serif élégante, couleur Encre (`#3A3D41`).
- Le point du « i » est un cercle cramoisi (`#D91B4B`), légèrement plus grand que la normale.
- **Baseline :** `LA CLARTÉ DU DROIT, LA FORCE DE LA TECHNOLOGIE.` (capitales, interlettrage large).
- Pas d'icône. Pas de balance, de colonne ni de casque romain.
- **Favicon :** la lettre « C » avec un petit point cramoisi.
- **Hauteur minimale :** 24 px. **Zone de protection :** la hauteur du « C » autour du logo.
- **Sur fond sombre :** lettres `#F8F7F4`, point cramoisi conservé.

### Ton éditorial
- Phrases courtes, verbes actifs, sentence case.
- **Exemples :** « Analyser », « Voir le détail », « Copier la correction ».
- **Erreurs :** expliquer ce qui s'est passé et comment corriger, sans s'excuser.
- **Promesse :** « Repérez les contradictions avant qu'elles ne soient publiées. »

---

## 3. Palette

### Neutres (chauds)

| Rôle | Nom | Hex |
| :--- | :--- | :--- |
| Fond de page | Papier | `#F8F7F4` |
| Surface (cartes, champ) | Blanc | `#FFFFFF` |
| Surface secondaire | Papier foncé | `#F0EEE9` |
| Bordure | Trait | `#E3E0D9` |
| Bordure au survol | Trait fort | `#C9C5BB` |
| Texte principal | Encre | `#3A3D41` |
| Titres, bouton principal | Encre profonde | `#1F2226` |
| Texte secondaire | Gris doux | `#6B6F76` |
| Texte discret | Gris clair | `#9A9DA3` |

### Signal

| Rôle | Nom | Hex |
| :--- | :--- | :--- |
| Signal / contradiction | Cramoisi | `#D91B4B` |
| Survol | Cramoisi foncé | `#B8143D` |
| Fond léger | Cramoisi clair | `#FCE8EE` |

### Types d'incohérence (toujours icône + libellé)

| Type | Couleur | Texte | Fond |
| :--- | :--- | :--- | :--- |
| Conflit | `#D91B4B` | `#B8143D` | `#FCE8EE` |
| Vide juridique | `#D97706` | `#A85A00` | `#FDF1DC` |
| Doublon | `#6D4AE0` | `#5B3BC4` | `#EFEBFC` |
| Texte obsolète | `#8A8F98` | `#5F646C` | `#ECEDEF` |
| Résolu | `#1F9D6B` | `#177A53` | `#E4F5EC` |

### Règles d'usage
- Bouton principal « Analyser » en **Encre profonde**, jamais en rouge.
- Le cramoisi sert à 4 endroits : point du logo, conflits, surlignage des passages contradictoires, compteur d'incohérences. Plus l'anneau de focus clavier.
- Texte coloré : utiliser les variantes « Texte » (contraste AA). Les couleurs vives sont réservées aux icônes, pastilles et surlignages.
- Un seul dégradé autorisé : Papier vers Papier foncé, en fond de page, très léger.

### Contrastes vérifiés
- Encre sur Papier : environ 10:1.
- Cramoisi sur Papier : environ 6:1.
- Orange vif sur Papier : moins de 3:1, donc jamais pour du texte.

---

## 4. Typographie

| Usage | Police | Détail |
| :--- | :--- | :--- |
| Titres, logo, extraits de lois | **Newsreader** (Google Fonts) | Poids 500, serif |
| Interface, boutons, libellés | **Inter** | Poids 400, 500, 600 |
| Références de textes (ex. Décret n° 2024-123) | **Geist Mono** ou monospace système | 13 px |

*Repli : `Georgia, serif` et `system-ui, sans-serif`.*

### Échelle

| Niveau | Taille desktop | Mobile | Détail |
| :--- | :--- | :--- | :--- |
| Titre hero | 64 px | 40 px | Newsreader 500, interlettrage -0.03em, interligne 1.05 |
| Titre de section | 32 px | 24 px | Newsreader 500, interlettrage -0.02em |
| Sous-titre | 20 px | 18 px | Inter 400, Gris doux |
| Corps | 17 px | 16 px | Inter 400, interligne 1.6 |
| Extrait de loi | 18 px | 17 px | Newsreader 400, interligne 1.7, 70 caractères max par ligne |
| Libellé / chip | 14 px | 14 px | Inter 500 |
| Légende | 13 px | 12 px | Inter 400, Gris doux |

**Règles :** pas de capitales pour les libellés d'interface (seule la baseline du logo en utilise). Pas de mot isolé coloré dans un titre.

---

## 5. Formes, espacement, ombres

- **Grille d'espacement :** 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 / 96 px.
- **Rayons :** champ de saisie 24 px, cartes 16 px, boutons et chips 999 px, petits éléments 8 px.
- **Bordures :** `1 px --line`. Pas de bordure épaisse.
- **Ombre douce :** `0 1px 2px rgba(31,34,38,.04), 0 8px 24px rgba(31,34,38,.06)`.
- **Ombre de survol :** `0 2px 4px rgba(31,34,38,.06), 0 16px 40px rgba(31,34,38,.10)`.
- **Largeur de contenu :** 760 px (accueil), 960 px (résultats).
- **Espace entre sections :** 64 à 96 px.

---

## 6. Mouvement

| Règle | Valeur |
| :--- | :--- |
| Durée par défaut | 200 ms, ease-out |
| Entrée de page | stagger 80 ms, opacité + montée de 12 px |
| Ressort (panneaux) | stiffness 300, damping 30 |
| Propriétés animées | `transform` et `opacity` uniquement |
| Réduction du mouvement | `prefers-reduced-motion` : on garde les fondus, on supprime le reste |

*Le mouvement non déclenché par l'utilisateur est limité à l'animation du logo, l'animation d'analyse et le surlignage. Le reste réagit aux actions.*

### Animation du logo (3 s)
1. Les lettres montent une à une depuis leur ligne de base (masque, stagger 90 ms).
2. Le point rouge tombe, rebondit légèrement, émet une onde.
3. La baseline apparaît, son interlettrage se resserre.

### Animation d'analyse (3 à 4 s, moment wow)
- La saisie remonte en pilule compacte en haut.
- Trois étapes se succèdent, chacune passant de *attente*, *en cours* (shimmer), à *terminé* (coche qui se dessine) :
  1. « Lecture du Journal Officiel… » (0 à 1,1 s)
  2. « Comparaison avec le droit européen… » (1,1 à 2,2 s)
  3. « Détection des contradictions… » (2,2 à 3,2 s)
- Compteur « textes analysés » qui monte jusqu'à environ 1 248.
- Barre de progression fine, couleur Encre profonde.
- À l'étape 3, un point cramoisi apparaît et pulse : une contradiction est repérée (écho au logo).
- Bouton discret « Passer l'animation ».

### Surlignage dans le détail
- 400 ms après l'ouverture, un effet marqueur balaie chaque passage contradictoire de gauche à droite (600 ms), fond Cramoisi clair + soulignement 2 px cramoisi.
- Une ligne courbe se dessine (`stroke-dashoffset`, 700 ms) entre les deux passages.

---

## 7. Écrans

### 7.1 Accueil

```text
[logo Cicero]                                            

        Repérez les contradictions
        avant qu'elles ne soient publiées.

   ┌──────────────────────────────────────────┐
   │ Décrivez ce que vous voulez vérifier…    │
   │                                          │
   │                                [Analyser]│
   └──────────────────────────────────────────┘
   [Domaine ▾] [Niveau de norme ▾] [Période ▾]   Plus d'options

   Essayer avec :
   [ Données de santé ] [ Durée du travail ] [ Urbanisme ]
```

- Alignement centré, largeur max 760 px.
- Champ : blanc, rayon 24 px, bordure `--line`, ombre douce, hauteur mini 120 px.
- Focus du champ : bordure cramoisi 1,5 px + halo cramoisi à 12 %.
- Placeholder animé qui cycle entre 3 exemples, s'arrête à la saisie.
- Bouton « Analyser » intégré en bas à droite : Encre profonde, texte blanc, désactivé tant que le champ est vide. Raccourci `Ctrl/⌘ + Entrée`.
- Trois exemples cliquables : au clic, le texte se tape dans le champ, les chips se sélectionnent un à un (120 ms), puis l'analyse démarre.

### 7.2 Options de cadrage
- 3 chips visibles : **Domaine**, **Niveau de norme**, **Période**.
- « Plus d'options » déplie : type d'incohérence, territoire, statut, sources, mots-clés. Hauteur animée en ressort, chips en cascade de 40 ms.
- Chip au repos : blanc, bordure `--line`, 36 px de haut, icône à gauche, chevron à droite.
- Chip sélectionnée : fond Encre profonde, texte blanc, compteur `(2)` si multi-sélection.
- Popover (shadcn `Popover` + `Command`) avec recherche, apparition scale 0.96 vers 1, 150 ms.
- **Niveau de norme :** liste en pyramide, du plus haut au plus bas : *Droit européen, Constitution, Loi, Ordonnance, Décret, Arrêté, Délibération locale*. Chaque ligne un peu plus large que la précédente.
- **Période :** raccourcis 1 an, 5 ans, 10 ans, Personnalisé (sélecteur de dates).
- Compteur de filtres actifs et bouton « Réinitialiser ».

### 7.3 Résultats
- Bandeau : « 5 incohérences détectées » (le chiffre en compteur animé, cramoisi), puis badges par type (2 conflits, 2 vides juridiques, 1 doublon), apparition en cascade.
- Barre de critères appliqués : badges retirables ; les cartes se réorganisent en animation de layout quand on retire un filtre.
- Carte d'incohérence : blanche, rayon 16 px, padding 24 px.
  - Pastille d'icône 40 px, fond clair du type.
  - Badge de type (icône + libellé), gravité en 3 barres.
  - Titre sur 1 ligne (Newsreader 20 px).
  - Deux pastilles mono avec les références des textes et leur niveau de norme.
  - Survol : bordure de la couleur du type, léger lift de 2 px, texte « Voir le détail » qui apparaît.
- Apparition : stagger 70 ms.

### 7.4 Vue détail (panneau latéral)
- shadcn `Sheet` depuis la droite, `70 vw` desktop, plein écran mobile. Overlay `rgba(31,34,38,.4)` avec flou 6 px. Fermeture par `Échap`.
- En-tête : badge de type, titre, bouton fermer.
- Deux colonnes (empilées sur mobile) : chaque texte avec sa référence en mono, son niveau de norme, sa date, puis l'extrait en serif.
- Au centre, une pastille « contre » avec le point cramoisi qui pulse.
- Passages contradictoires surlignés (voir section 6).
- Encadré **« Analyse »** : explication en une phrase, qui s'écrit caractère par caractère.
- Encadré **« Suggestion de correction »** : mini-diff (ancien texte barré en cramoisi, nouveau texte en vert).
- Actions : « Copier la correction », « Marquer comme traité » (le bouton passe au vert avec une coche, la carte se grise dans la liste).

### 7.5 États secondaires (simples)
- **Vide (première visite) :** l'accueil lui-même.
- **Chargement :** skeletons avec shimmer discret.
- **Aucun résultat :** « Aucune contradiction trouvée avec ces critères. » + bouton « Élargir les filtres ».
- **Erreur :** « L'analyse a échoué. Vérifiez votre connexion puis réessayez. » + bouton « Réessayer ».

---

## 8. Composants (shadcn/ui, style 21st.dev)

| Composant | Base | Particularité Cicero |
| :--- | :--- | :--- |
| Champ de saisie | `Textarea` | Rayon 24 px, focus cramoisi |
| Bouton principal | `Button` | Encre profonde, léger lift au survol, scale 0.97 au clic |
| Bouton secondaire | `Button outline` | Bordure `--line`, fond blanc |
| Chip de filtre | `Toggle` / `Popover` | Voir 7.2 |
| Carte | `Card` | Voir 7.3 |
| Panneau détail | `Sheet` | Voir 7.4 |
| Badge de type | `Badge` | Icône + libellé, fond clair du type |
| Compteur animé | `Number ticker` | 0 vers N en 800 ms |
| Toast | `Sonner` | Discret, bas de page |
| Skeleton | `Skeleton` | Shimmer lent |

*Inspiration : composants de 21st.dev (Magic UI, Motion Primitives, Kokonut UI) : épurés, animations fluides. On adapte à la palette Cicero, on ne copie pas leurs couleurs.*

---

## 9. Responsive

| Écran | Adaptation |
| :--- | :--- |
| Desktop (≥ 1024 px) | Mise en page décrite ci-dessus, priorité projecteur |
| Tablette | Largeur de contenu 640 px, chips sur 2 lignes |
| Mobile | Titre 40 px, options dans un tiroir plein écran avec « Appliquer (n) », bouton « Analyser » fixé en bas, détail en plein écran, textes empilés |

*Zones cliquables d'au moins 44 × 44 px sur mobile.*

---

## 10. Accessibilité

- Contrastes AA minimum, y compris pour les types d'incohérence.
- Focus clavier visible : anneau cramoisi 2 px avec décalage 2 px.
- Navigation clavier complète, ordre logique, `Échap` ferme les panneaux.
- `aria-expanded` sur « Plus d'options », `aria-live="polite"` pour le compteur de résultats et les étapes d'analyse.
- La couleur ne porte jamais l'information seule : icône + libellé.
- Surlignage : fond + soulignement (visible aussi en niveaux de gris).
- `prefers-reduced-motion` respecté.

---

## 11. Données mockées

- 5 à 6 incohérences fictives sur un thème (données de santé), marquées « fictif ».
- Chaque entrée : `id`, `titre`, `type`, `gravité`, deux textes (`référence`, `niveau de norme`, `date`, `extrait`), passages à surligner, explication de l'IA, suggestion de correction.
- Les filtres (domaine, niveau, période, type) fonctionnent réellement sur ces données.
- Mention en bas de page : « Démonstration : données fictives. »
- Cas de démo recommandé : un arrêté qui contredit un décret sur la durée de conservation des données de santé.

---

## 12. Variables CSS

```css
:root {
  /* Neutres */
  --paper: #F8F7F4;
  --surface: #FFFFFF;
  --surface-2: #F0EEE9;
  --line: #E3E0D9;
  --line-strong: #C9C5BB;
  --ink: #3A3D41;
  --ink-deep: #1F2226;
  --ink-soft: #6B6F76;
  --ink-faint: #9A9DA3;

  /* Signal */
  --signal: #D91B4B;
  --signal-hover: #B8143D;
  --signal-bg: #FCE8EE;

  /* Types */
  --conflict: #D91B4B;   --conflict-text: #B8143D;  --conflict-bg: #FCE8EE;
  --gap: #D97706;        --gap-text: #A85A00;       --gap-bg: #FDF1DC;
  --duplicate: #6D4AE0;  --duplicate-text: #5B3BC4; --duplicate-bg: #EFEBFC;
  --obsolete: #8A8F98;   --obsolete-text: #5F646C;  --obsolete-bg: #ECEDEF;
  --resolved: #1F9D6B;   --resolved-text: #177A53;  --resolved-bg: #E4F5EC;

  /* Formes */
  --radius-input: 24px;
  --radius-card: 16px;
  --radius-small: 8px;
  --radius-pill: 999px;
  --shadow-soft: 0 1px 2px rgba(31,34,38,.04), 0 8px 24px rgba(31,34,38,.06);
  --shadow-hover: 0 2px 4px rgba(31,34,38,.06), 0 16px 40px rgba(31,34,38,.10);

  /* Typo */
  --font-serif: "Newsreader", Georgia, serif;
  --font-sans: "Inter", system-ui, sans-serif;
  --font-mono: "Geist Mono", ui-monospace, monospace;

  /* Mouvement */
  --ease: cubic-bezier(.2, .8, .2, 1);
  --duration: 200ms;
}
```

### Thème Tailwind (extrait)

```js
theme: {
  extend: {
    colors: {
      paper: "var(--paper)", surface: "var(--surface)",
      line: "var(--line)", ink: { DEFAULT: "var(--ink)", deep: "var(--ink-deep)", soft: "var(--ink-soft)" },
      signal: { DEFAULT: "var(--signal)", hover: "var(--signal-hover)", bg: "var(--signal-bg)" },
    },
    fontFamily: { serif: ["var(--font-serif)"], sans: ["var(--font-sans)"], mono: ["var(--font-mono)"] },
    borderRadius: { input: "24px", card: "16px" },
  },
}
```

---

## 13. Ordre d'implémentation (priorité démo)

1. Tokens, polices, fond de page.
2. Accueil : titre, champ de saisie, bouton, exemples cliquables.
3. Animation d'analyse.
4. Résultats : bandeau, cartes.
5. Vue détail : deux textes, surlignage, ligne de connexion.
6. Chips de filtres et « Plus d'options », filtrage réel sur les mocks.
7. États secondaires, responsive mobile.
8. Finitions : toasts, micro-interactions.

*S'arrêter à chaque étape pour validation.*

---

## 14. Prompt de mise en œuvre pour Codex

```text
Implémente le design décrit dans DESIGN.md pour Cicero (démo de hackathon,
front-end uniquement, backend mocké).

Stack : React + Tailwind + shadcn/ui + Framer Motion, composants dans le
style de 21st.dev. Aucune dépendance en plus.

Règles :
- Aucune couleur en dur : tout passe par les variables de la section 12.
- Bouton principal en Encre profonde, jamais rouge. Le cramoisi suit les
  règles de la section 3.
- Respecte l'ordre de la section 13 et arrête-toi à chaque étape.
- Les filtres fonctionnent réellement sur les mocks (section 11 et 17).
- Accessibilité de la section 10 obligatoire.

Avant de coder : résume la stack existante et propose un plan en 5 lignes.
À la fin : fichiers modifiés et scénario de démo en 4 étapes.
```

---

## 15. Scénario de démo (2 minutes)

1. **Accueil :** le logo s'anime, on lit la promesse.
2. **Clic sur « Données de santé » :** le texte se tape, les filtres se cochent.
3. **Analyse :** les 3 étapes défilent, le point rouge apparaît.
4. **Résultats :** « 5 incohérences détectées », on ouvre le conflit le plus parlant.
5. **Détail :** les deux textes, le surlignage, la ligne de connexion, la suggestion de correction.

---

## 16. Arborescence des fichiers (cible)

```text
src/
├── app/
│   ├── globals.css          # Variables CSS (section 12) + import Google Fonts
│   ├── layout.tsx           # Polices Newsreader, Inter, Geist Mono + Toaster
│   └── page.tsx             # État global unique (idle | analyzing | results)
├── components/
│   ├── CiceroLogo.tsx       # Wordmark SVG + animation d'entrée du point cramoisi
│   ├── SearchHero.tsx       # Champ de saisie, placeholder cyclique, 3 exemples
│   ├── FilterBar.tsx        # 3 chips principales + tiroir « Plus d'options »
│   ├── AnalysisLoader.tsx   # Moment wow : 3 étapes + compteur + point cramoisi
│   ├── ResultsList.tsx      # Bandeau compteur + barre de critères + grille de cartes
│   ├── ConflictCard.tsx     # Carte d'incohérence individuelle
│   └── DetailSheet.tsx      # Panneau latéral, 2 colonnes, courbe SVG, diff
└── data/
    └── mocks.ts             # Les 3 scénarios d'exemples + les 5 incohérences
```

---

## 17. Jeu de données mockées complet (`src/data/mocks.ts`)

```ts
export interface LegalText {
  reference: string;
  normLevel:
    | "Droit européen"
    | "Constitution"
    | "Loi"
    | "Ordonnance"
    | "Décret"
    | "Arrêté"
    | "Délibération locale";
  date: string;
  excerpt: string;
  highlight: string; // sous-chaîne exacte à surligner dans excerpt
}

export interface Inconsistency {
  id: string;
  title: string;
  type: "conflict" | "gap" | "duplicate" | "obsolete";
  typeLabel: "Conflit" | "Vide juridique" | "Doublon" | "Texte obsolète";
  severity: 1 | 2 | 3;
  domain: string;
  periodYears: number;
  sourceText: LegalText;
  targetText: LegalText;
  aiExplanation: string;
  suggestion: {
    removed: string;
    added: string;
  };
  resolved?: boolean;
}

export const DEMO_PROMPTS = [
  {
    id: "sante",
    label: "Données de santé",
    text: "Projet d'arrêté fixant la durée de conservation des dossiers médicaux partagés à 5 ans chez les hébergeurs certifiés.",
    filters: {
      domaine: "Santé publique",
      niveau: ["Décret", "Arrêté"],
      periode: "5 ans",
    },
  },
  {
    id: "travail",
    label: "Durée du travail",
    text: "Projet de décret dérogeant au repos quotidien minimal de 11 heures consécutives pour les astreintes techniques.",
    filters: {
      domaine: "Droit du travail",
      niveau: ["Droit européen", "Loi", "Décret"],
      periode: "10 ans",
    },
  },
  {
    id: "urbanisme",
    label: "Urbanisme",
    text: "Délibération municipale imposant un recul de 8 mètres par rapport aux voies publiques en zone U du PLU.",
    filters: {
      domaine: "Urbanisme",
      niveau: ["Loi", "Décret", "Délibération locale"],
      periode: "1 an",
    },
  },
];

export const MOCK_INCONSISTENCIES: Inconsistency[] = [
  {
    id: "inc-1",
    title: "Durée minimale de conservation du dossier médical ramenée à 5 ans",
    type: "conflict",
    typeLabel: "Conflit",
    severity: 3,
    domain: "Santé publique",
    periodYears: 5,
    sourceText: {
      reference: "Projet d'arrêté SANP2600142A — art. 4 (fictif)",
      normLevel: "Arrêté",
      date: "Octobre 2026",
      excerpt:
        "Les données de santé à caractère personnel hébergées sur les plateformes numériques régionales sont conservées pendant une durée de cinq ans à compter de la dernière consultation, puis détruites automatiquement.",
      highlight:
        "conservées pendant une durée de cinq ans à compter de la dernière consultation",
    },
    targetText: {
      reference: "Code de la santé publique — art. R. 1112-7 (Décret n° 2022-610)",
      normLevel: "Décret",
      date: "21 avril 2022",
      excerpt:
        "Le dossier médical mentionné à l'article R. 1112-2 est conservé pendant une durée de vingt ans à compter de la date du dernier séjour de son titulaire dans l'établissement ou de la dernière consultation externe en son sein.",
      highlight:
        "conservé pendant une durée de vingt ans à compter de la date du dernier séjour",
    },
    aiExplanation:
      "Un arrêté ministériel ne peut pas réduire à 5 ans une durée de conservation fixée à 20 ans par décret en Conseil d'État (violation de la hiérarchie des normes).",
    suggestion: {
      removed: "pendant une durée de cinq ans à compter de la dernière consultation",
      added:
        "pendant la durée de vingt ans prévue à l'article R. 1112-7 du code de la santé publique",
    },
  },
  {
    id: "inc-2",
    title: "Transfert transfrontalier d'échantillons anonymisés sans base d'adéquation",
    type: "conflict",
    typeLabel: "Conflit",
    severity: 3,
    domain: "Santé publique",
    periodYears: 10,
    sourceText: {
      reference: "Projet d'arrêté SANP2600142A — art. 9 (fictif)",
      normLevel: "Arrêté",
      date: "Octobre 2026",
      excerpt:
        "Les hébergeurs agréés peuvent répliquer les bases pseudonymisées sur tout serveur de sauvegarde situé hors de l'Union européenne sur simple déclaration préalable au ministère.",
      highlight: "sur simple déclaration préalable au ministère",
    },
    targetText: {
      reference: "Règlement (UE) 2016/679 (RGPD) — art. 45 et 46",
      normLevel: "Droit européen",
      date: "27 avril 2016",
      excerpt:
        "En l'absence de décision d'adéquation, le responsable du traitement ou le sous-traitant ne peut transférer des données à caractère personnel vers un pays tiers que s'il a prévu des garanties appropriées et des droits opposables.",
      highlight:
        "ne peut transférer des données à caractère personnel vers un pays tiers que s'il a prévu des garanties appropriées",
    },
    aiExplanation:
      "Les données pseudonymisées restent des données personnelles au sens du RGPD : une simple déclaration ministérielle ne remplace pas les garanties prévues à l'article 46.",
    suggestion: {
      removed: "sur simple déclaration préalable au ministère",
      added:
        "sous réserve d'une décision d'adéquation ou des garanties appropriées prévues à l'article 46 du règlement (UE) 2016/679",
    },
  },
  {
    id: "inc-3",
    title: "Absence de délai de notification en cas d'incident sur mineur",
    type: "gap",
    typeLabel: "Vide juridique",
    severity: 2,
    domain: "Santé publique",
    periodYears: 5,
    sourceText: {
      reference: "Projet d'arrêté SANP2600142A — art. 12 (fictif)",
      normLevel: "Arrêté",
      date: "Octobre 2026",
      excerpt:
        "En cas de compromission d'un dossier, l'hébergeur informe directement le patient majeur sous soixante-douze heures par voie électronique sécurisée.",
      highlight: "informe directement le patient majeur sous soixante-douze heures",
    },
    targetText: {
      reference: "Loi n° 78-17 Informatique et Libertés — art. 58",
      normLevel: "Loi",
      date: "1 juin 2019",
      excerpt:
        "Lorsque la violation est susceptible d'engendrer un risque élevé pour les droits et libertés d'une personne physique, le responsable du traitement communique la violation à la personne concernée dans les meilleurs délais.",
      highlight:
        "communique la violation à la personne concernée dans les meilleurs délais",
    },
    aiExplanation:
      "Le projet d'arrêté encadre uniquement la notification du patient majeur et omet les titulaires de l'autorité parentale pour les dossiers de patients mineurs.",
    suggestion: {
      removed: "informe directement le patient majeur",
      added:
        "informe directement le patient ou, s'il est mineur, les titulaires de l'autorité parentale",
    },
  },
  {
    id: "inc-4",
    title: "Délai de rétractation du consentement non précisé pour la recherche secondaire",
    type: "gap",
    typeLabel: "Vide juridique",
    severity: 2,
    domain: "Santé publique",
    periodYears: 1,
    sourceText: {
      reference: "Projet d'arrêté SANP2600142A — art. 15 (fictif)",
      normLevel: "Arrêté",
      date: "Octobre 2026",
      excerpt:
        "L'opposition du patient à la réutilisation de ses données à des fins de recherche entraîne le retrait de ses données des jeux d'entraînement.",
      highlight: "entraîne le retrait de ses données des jeux d'entraînement",
    },
    targetText: {
      reference:
        "Décret n° 2025-308 relatif aux entrepôts de données de santé — art. 3 (fictif)",
      normLevel: "Décret",
      date: "14 mars 2025",
      excerpt:
        "Tout gestionnaire d'entrepôt procède à l'effacement effectif des données faisant l'objet d'une opposition dans un délai maximal de trente jours francs à compter de la réception de la demande.",
      highlight:
        "dans un délai maximal de trente jours francs à compter de la réception",
    },
    aiExplanation:
      "Sans rappel du délai maximal de 30 jours francs fixé par le décret de 2025, l'obligation de retrait reste imprécise quant à sa date d'effet.",
    suggestion: {
      removed: "entraîne le retrait de ses données des jeux d'entraînement",
      added:
        "entraîne le retrait effectif de ses données des jeux d'entraînement dans le délai maximal de trente jours francs prévu par décret",
    },
  },
  {
    id: "inc-5",
    title: "Double obligation de transmission du rapport annuel d'audit HDS",
    type: "duplicate",
    typeLabel: "Doublon",
    severity: 1,
    domain: "Santé publique",
    periodYears: 5,
    sourceText: {
      reference: "Projet d'arrêté SANP2600142A — art. 18 (fictif)",
      normLevel: "Arrêté",
      date: "Octobre 2026",
      excerpt:
        "Chaque hébergeur certifié adresse avant le 31 mars de chaque année un rapport complet d'audit de sécurité à l'Agence du numérique en santé.",
      highlight:
        "adresse avant le 31 mars de chaque année un rapport complet d'audit de sécurité",
    },
    targetText: {
      reference: "Arrêté du 26 avril 2024 portant référentiel HDS — art. 6 (fictif)",
      normLevel: "Arrêté",
      date: "26 avril 2024",
      excerpt:
        "Le titulaire du certificat transmet annuellement, au plus tard le dernier jour ouvré du mois de mars, son rapport d'audit de surveillance à l'Agence du numérique en santé.",
      highlight:
        "transmet annuellement, au plus tard le dernier jour ouvré du mois de mars, son rapport d'audit",
    },
    aiExplanation:
      "Cette obligation de transmission annuelle fin mars existe déjà en termes quasi identiques dans l'arrêté du 26 avril 2024.",
    suggestion: {
      removed:
        "Article 18 : Chaque hébergeur certifié adresse avant le 31 mars de chaque année un rapport complet d'audit de sécurité à l'Agence du numérique en santé.",
      added:
        "[Supprimer l'article 18 ou renvoyer à l'article 6 de l'arrêté du 26 avril 2024]",
    },
  },
];
```

---

## 18. Détails d'implémentation des 3 animations clés

### 18.1 Surlignage marqueur (dans `DetailSheet.tsx`)
Découper `excerpt` autour de `highlight` et envelopper la sous-chaîne dans un `<mark>` animé :

```css
.highlight-mark {
  background-image: linear-gradient(var(--signal-bg), var(--signal-bg));
  background-repeat: no-repeat;
  background-size: 0% 100%;
  border-bottom: 2px solid transparent;
  transition: background-size 600ms cubic-bezier(.2, .8, .2, 1) 400ms,
              border-color 200ms ease 800ms;
}
.highlight-mark.active {
  background-size: 100% 100%;
  border-bottom-color: var(--signal);
}
```

### 18.2 Courbe de connexion entre les deux textes
Placer un `<svg>` absolu centré entre la colonne de gauche et la colonne de droite sur desktop :
- Calculer `getBoundingClientRect()` des deux `<mark>` à l'ouverture du panneau (après 400 ms).
- Tracer un `<path d="M x1 y1 C cx1 y1, cx2 y2, x2 y2" />` en trait plein de `1.5px` couleur `var(--signal)`.
- Animer avec Framer Motion : `initial={{ pathLength: 0, opacity: 0 }}` vers `animate={{ pathLength: 1, opacity: 1 }}` (`duration: 0.7, delay: 0.6`).

### 18.3 Pyramide des normes (dans le filtre « Niveau de norme »)
Calculer la largeur de chaque ligne proportionnellement à son rang :
1. Droit européen (`width: 52%`)
2. Constitution (`width: 60%`)
3. Loi (`width: 68%`)
4. Ordonnance (`width: 76%`)
5. Décret (`width: 84%`)
6. Arrêté (`width: 92%`)
7. Délibération locale (`width: 100%`)

---

## 19. Script oral synchronisé (Pitch de 2 minutes)

| Chrono | Action à l'écran | Ce que dit le pitcheur |
| :--- | :--- | :--- |
| **0:00 – 0:20** | Arrivée sur l'accueil. Le logo **Cicero** s'anime, le point rouge rebondit. | *« Chaque année en France, des milliers de décrets et d'arrêtés sont publiés. Au milieu de 80 000 articles de codes, une contradiction avec une norme supérieure passe vite inaperçue — jusqu'au recours devant le Conseil d'État. Voici Cicero. »* |
| **0:20 – 0:40** | Clic sur la puce **« Données de santé »**. Le texte se tape tout seul, les filtres se cochent. | *« Imaginons un rédacteur au ministère de la Santé qui prépare un arrêté sur la conservation des dossiers médicaux. Un clic suffit pour cadrer le domaine et la hiérarchie des normes. »* |
| **0:40 – 0:55** | L'animation d'analyse démarre : 3 étapes, compteur à 1 248 textes, puis le point rouge pulse. | *« Cicero confronte le projet au Journal Officiel et au droit européen. Tant que tout va bien, l'interface reste calme. Quand le point rouge apparaît, une contradiction est avérée. »* |
| **0:55 – 1:15** | Les **5 incohérences** s'affichent. Survol puis clic sur la 1re carte (*Durée ramenée à 5 ans*). | *« Cinq incohérences détectées : deux conflits directs, deux vides juridiques, un doublon. Regardons le conflit critique. »* |
| **1:15 – 1:45** | Le panneau s'ouvre. Les deux passages se surlignent en cramoisi, la courbe les relie, l'analyse s'écrit. | *« À gauche, notre projet d'arrêté fixe la conservation à 5 ans. À droite, l'article R. 1112-7 du Code de la santé publique — un décret — impose 20 ans. Un arrêté ne peut pas contredire un décret. »* |
| **1:45 – 2:00** | Clic sur **« Copier la correction »**, puis **« Marquer comme traité »** (passe au vert). | *« Cicero propose directement la réécriture conforme. On copie, on marque comme traité. La clarté du droit, la force de la technologie. »* |

---

## 20. Checklist « En cas de doute : on retire »

- [ ] **Zéro rouge au repos** sur la page d'accueil (hors point du logo et focus clavier).
- [ ] **Pas de chatbot**, pas d'avatar d'IA, pas de bulles de conversation.
- [ ] **Lisible à 5 mètres** : vérifier le rendu en reculant devant l'écran.
- [ ] **Raccourci `Échap`** fonctionnel sur le panneau latéral et les popovers.
- [ ] **Bouton « Passer l'animation »** fonctionnel au cas où le jury demande de revenir en arrière pendant les Q&A.
- [ ] **Mention « Démonstration : données fictives. »** présente en pied de page en `13px` Gris doux.