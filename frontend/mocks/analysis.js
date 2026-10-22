/* Tous les textes, références et raisonnements de ce fichier sont fictifs. */
(function (root) {
  'use strict';
  const meta = {
    conflict: {label:'Conflit', plural:'conflits', icon:'warning'},
    gap: {label:'Vide juridique', plural:'vides juridiques', icon:'gap'},
    duplicate: {label:'Doublon', plural:'doublons', icon:'copy'},
    obsolete: {label:'Texte obsolète', plural:'textes obsolètes', icon:'clock'}
  };
  const domains = {health:'Santé publique',work:'Droit du travail',urban:'Urbanisme'};
  const norms = {european:'Droit européen',constitution:'Constitution',law:'Loi',ordinance:'Ordonnance',decree:'Décret',order:'Arrêté',local:'Délibération locale'};
  const sourceNames = {jo:'Journal officiel',eurlex:'EUR-Lex',local:'Actes locaux'};
  const territoryNames = {france:'France',europe:'Union européenne',local:'Collectivités'};
  const statusNames = {draft:'En projet',in_force:'En vigueur',repealed:'Abrogé'};
  const text = (title,reference,date,norm,source,before,highlight,after='') => ({title,reference,date,norm,source,before,highlight,after,languages:source==='eurlex'?['fr','en']:['fr']});
  const issues = [
  {
    "id": "inc-1",
    "theme": "health",
    "type": "conflict",
    "severity": "critical",
    "title": "Durée minimale de conservation du dossier médical ramenée à 5 ans",
    "date": "2026-10-18",
    "territory": "france",
    "status": "draft",
    "texts": [
      {
        "title": "Projet d’arrêté sur les données de santé",
        "role": "Projet examiné",
        "reference": "Projet d'arrêté SANP2600142A — art. 4 (fictif)",
        "date": "2026-10-18",
        "norm": "order",
        "source": "jo",
        "before": "Les données de santé à caractère personnel hébergées sur les plateformes numériques régionales sont ",
        "highlight": "conservées pendant une durée de cinq ans à compter de la dernière consultation",
        "after": ", puis détruites automatiquement.",
        "languages": [
          "fr"
        ]
      },
      {
        "title": "Cadre applicable au projet",
        "role": "Texte de référence",
        "reference": "Code de la santé publique — art. R. 1112-7 (Décret n° 2022-610) (fictif)",
        "date": "2022-04-21",
        "norm": "decree",
        "source": "jo",
        "before": "Le dossier médical mentionné à l'article R. 1112-2 est ",
        "highlight": "conservé pendant une durée de vingt ans à compter de la date du dernier séjour",
        "after": " de son titulaire dans l'établissement ou de la dernière consultation externe en son sein.",
        "languages": [
          "fr"
        ]
      }
    ],
    "explanation": "Un arrêté ministériel ne peut pas réduire à 5 ans une durée de conservation fixée à 20 ans par décret en Conseil d'État (violation de la hiérarchie des normes).",
    "suggestion": "Proposition de réécriture à confirmer au regard du champ d’application et du corpus complet.",
    "removed": "pendant une durée de cinq ans à compter de la dernière consultation",
    "correction": "pendant la durée de vingt ans prévue à l'article R. 1112-7 du code de la santé publique"
  },
  {
    "id": "inc-2",
    "theme": "health",
    "type": "conflict",
    "severity": "critical",
    "title": "Transfert transfrontalier d'échantillons anonymisés sans base d'adéquation",
    "date": "2026-10-18",
    "territory": "france",
    "status": "draft",
    "texts": [
      {
        "title": "Projet d’arrêté sur les données de santé",
        "role": "Projet examiné",
        "reference": "Projet d'arrêté SANP2600142A — art. 9 (fictif)",
        "date": "2026-10-18",
        "norm": "order",
        "source": "jo",
        "before": "Les hébergeurs agréés peuvent répliquer les bases pseudonymisées sur tout serveur de sauvegarde situé hors de l'Union européenne ",
        "highlight": "sur simple déclaration préalable au ministère",
        "after": ".",
        "languages": [
          "fr"
        ]
      },
      {
        "title": "Cadre applicable au projet",
        "role": "Texte de référence",
        "reference": "Règlement (UE) 2016/679 (RGPD) — art. 45 et 46 (fictif)",
        "date": "2016-04-27",
        "norm": "european",
        "source": "eurlex",
        "before": "En l'absence de décision d'adéquation, le responsable du traitement ou le sous-traitant ",
        "highlight": "ne peut transférer des données à caractère personnel vers un pays tiers que s'il a prévu des garanties appropriées",
        "after": " et des droits opposables.",
        "languages": [
          "fr",
          "en"
        ]
      }
    ],
    "explanation": "Les données pseudonymisées restent des données personnelles au sens du RGPD : une simple déclaration ministérielle ne remplace pas les garanties prévues à l'article 46.",
    "suggestion": "Proposition de réécriture à confirmer au regard du champ d’application et du corpus complet.",
    "removed": "sur simple déclaration préalable au ministère",
    "correction": "sous réserve d'une décision d'adéquation ou des garanties appropriées prévues à l'article 46 du règlement (UE) 2016/679"
  },
  {
    "id": "inc-3",
    "theme": "health",
    "type": "gap",
    "severity": "high",
    "title": "Absence de délai de notification en cas d'incident sur mineur",
    "date": "2026-10-18",
    "territory": "france",
    "status": "draft",
    "texts": [
      {
        "title": "Projet d’arrêté sur les données de santé",
        "role": "Projet examiné",
        "reference": "Projet d'arrêté SANP2600142A — art. 12 (fictif)",
        "date": "2026-10-18",
        "norm": "order",
        "source": "jo",
        "before": "En cas de compromission d'un dossier, l'hébergeur ",
        "highlight": "informe directement le patient majeur sous soixante-douze heures",
        "after": " par voie électronique sécurisée.",
        "languages": [
          "fr"
        ]
      },
      {
        "title": "Cadre applicable au projet",
        "role": "Texte de référence",
        "reference": "Loi n° 78-17 Informatique et Libertés — art. 58 (fictif)",
        "date": "2019-06-01",
        "norm": "law",
        "source": "jo",
        "before": "Lorsque la violation est susceptible d'engendrer un risque élevé pour les droits et libertés d'une personne physique, le responsable du traitement ",
        "highlight": "communique la violation à la personne concernée dans les meilleurs délais",
        "after": ".",
        "languages": [
          "fr"
        ]
      }
    ],
    "explanation": "Le projet d'arrêté encadre uniquement la notification du patient majeur et omet les titulaires de l'autorité parentale pour les dossiers de patients mineurs.",
    "suggestion": "Proposition de réécriture à confirmer au regard du champ d’application et du corpus complet.",
    "removed": "informe directement le patient majeur",
    "correction": "informe directement le patient ou, s'il est mineur, les titulaires de l'autorité parentale"
  },
  {
    "id": "inc-4",
    "theme": "health",
    "type": "gap",
    "severity": "high",
    "title": "Délai de rétractation du consentement non précisé pour la recherche secondaire",
    "date": "2026-10-18",
    "territory": "france",
    "status": "draft",
    "texts": [
      {
        "title": "Projet d’arrêté sur les données de santé",
        "role": "Projet examiné",
        "reference": "Projet d'arrêté SANP2600142A — art. 15 (fictif)",
        "date": "2026-10-18",
        "norm": "order",
        "source": "jo",
        "before": "L'opposition du patient à la réutilisation de ses données à des fins de recherche ",
        "highlight": "entraîne le retrait de ses données des jeux d'entraînement",
        "after": ".",
        "languages": [
          "fr"
        ]
      },
      {
        "title": "Cadre applicable au projet",
        "role": "Texte de référence",
        "reference": "Décret n° 2025-308 relatif aux entrepôts de données de santé — art. 3 (fictif)",
        "date": "2025-03-14",
        "norm": "decree",
        "source": "jo",
        "before": "Tout gestionnaire d'entrepôt procède à l'effacement effectif des données faisant l'objet d'une opposition ",
        "highlight": "dans un délai maximal de trente jours francs à compter de la réception",
        "after": " de la demande.",
        "languages": [
          "fr"
        ]
      }
    ],
    "explanation": "Sans rappel du délai maximal de 30 jours francs fixé par le décret de 2025, l'obligation de retrait reste imprécise quant à sa date d'effet.",
    "suggestion": "Proposition de réécriture à confirmer au regard du champ d’application et du corpus complet.",
    "removed": "entraîne le retrait de ses données des jeux d'entraînement",
    "correction": "entraîne le retrait effectif de ses données des jeux d'entraînement dans le délai maximal de trente jours francs prévu par décret"
  },
  {
    "id": "inc-5",
    "theme": "health",
    "type": "duplicate",
    "severity": "medium",
    "title": "Double obligation de transmission du rapport annuel d'audit HDS",
    "date": "2026-10-18",
    "territory": "france",
    "status": "draft",
    "texts": [
      {
        "title": "Projet d’arrêté sur les données de santé",
        "role": "Projet examiné",
        "reference": "Projet d'arrêté SANP2600142A — art. 18 (fictif)",
        "date": "2026-10-18",
        "norm": "order",
        "source": "jo",
        "before": "Chaque hébergeur certifié ",
        "highlight": "adresse avant le 31 mars de chaque année un rapport complet d'audit de sécurité",
        "after": " à l'Agence du numérique en santé.",
        "languages": [
          "fr"
        ]
      },
      {
        "title": "Cadre applicable au projet",
        "role": "Texte de référence",
        "reference": "Arrêté du 26 avril 2024 portant référentiel HDS — art. 6 (fictif)",
        "date": "2024-04-26",
        "norm": "order",
        "source": "jo",
        "before": "Le titulaire du certificat ",
        "highlight": "transmet annuellement, au plus tard le dernier jour ouvré du mois de mars, son rapport d'audit",
        "after": " de surveillance à l'Agence du numérique en santé.",
        "languages": [
          "fr"
        ]
      }
    ],
    "explanation": "Cette obligation de transmission annuelle fin mars existe déjà en termes quasi identiques dans l'arrêté du 26 avril 2024.",
    "suggestion": "Proposition de réécriture à confirmer au regard du champ d’application et du corpus complet.",
    "removed": "Article 18 : Chaque hébergeur certifié adresse avant le 31 mars de chaque année un rapport complet d'audit de sécurité à l'Agence du numérique en santé.",
    "correction": "[Supprimer l'article 18 ou renvoyer à l'article 6 de l'arrêté du 26 avril 2024]"
  },
  {
    "id": "LG-039",
    "theme": "work",
    "type": "conflict",
    "severity": "critical",
    "title": "Repos quotidien : une protection contradictoire.",
    "date": "2026-07-10",
    "territory": "france",
    "status": "draft",
    "texts": [
      {
        "title": "Garanties du repos quotidien",
        "reference": "Loi n° 2024-381 · art. 18",
        "date": "2024-04-15",
        "norm": "law",
        "source": "jo",
        "before": "Tout salarié concerné bénéficie d’un repos quotidien d’au moins ",
        "highlight": "11 heures consécutives",
        "after": " entre deux périodes de travail.",
        "languages": [
          "fr"
        ]
      },
      {
        "title": "Projet d’aménagement des horaires",
        "reference": "Projet de décret n° 2026-705 · art. 7",
        "date": "2026-07-10",
        "norm": "decree",
        "source": "jo",
        "before": "Les établissements concernés peuvent ramener le repos quotidien à ",
        "highlight": "9 heures consécutives",
        "after": " sans compensation prévue par le présent texte.",
        "languages": [
          "fr"
        ]
      }
    ],
    "explanation": "Le projet réduit le repos à 9 heures sans prévoir, dans le périmètre examiné, de base légale de dérogation ni de compensation.",
    "suggestion": "Maintenir le minimum de 11 heures ou faire vérifier et préciser le fondement ainsi que les garanties d’une éventuelle dérogation.",
    "correction": "Les établissements garantissent un repos quotidien d’au moins 11 heures consécutives, sauf dérogation légalement fondée et compensée."
  },
  {
    "id": "LG-038",
    "theme": "work",
    "type": "gap",
    "severity": "high",
    "title": "Télétravail : les dossiers en cours oubliés.",
    "date": "2026-03-02",
    "territory": "france",
    "status": "draft",
    "texts": [
      {
        "title": "Projet relatif aux accords de télétravail",
        "reference": "Projet de décret n° 2026-214 · art. 15",
        "date": "2026-03-02",
        "norm": "decree",
        "source": "jo",
        "before": "Le nouveau dispositif s’applique ",
        "highlight": "dès le lendemain de sa publication",
        "after": " aux demandes de télétravail.",
        "languages": [
          "fr"
        ]
      },
      {
        "title": "Instruction des demandes antérieures",
        "reference": "Arrêté du 12 février 2023 · art. 5",
        "date": "2023-02-12",
        "norm": "order",
        "source": "jo",
        "before": "Les demandes déposées au titre du régime antérieur sont instruites ",
        "highlight": "dans un délai de trois mois",
        "after": " à compter de leur réception.",
        "languages": [
          "fr"
        ]
      }
    ],
    "explanation": "Le projet ne détermine pas le régime applicable aux demandes déjà déposées et encore en cours d’instruction.",
    "suggestion": "Ajouter une disposition transitoire maintenant explicitement le régime antérieur pour les demandes déposées avant l’entrée en vigueur.",
    "correction": "Les demandes déposées avant l’entrée en vigueur restent instruites selon le régime antérieur."
  },
  {
    "id": "LG-037",
    "theme": "work",
    "type": "obsolete",
    "severity": "medium",
    "title": "Une procédure renvoie à un registre abrogé.",
    "date": "2019-09-18",
    "territory": "france",
    "status": "in_force",
    "texts": [
      {
        "title": "Tenue des relevés d’horaires",
        "reference": "Arrêté du 18 septembre 2019 · art. 4",
        "date": "2019-09-18",
        "norm": "order",
        "source": "jo",
        "before": "Les relevés sont établis selon le modèle du ",
        "highlight": "registre prévu par l’article 6 du décret de 2017",
        "after": " et conservés par l’employeur.",
        "languages": [
          "fr"
        ]
      },
      {
        "title": "Suppression du registre papier",
        "reference": "Décret n° 2024-566 · art. 11",
        "date": "2024-05-23",
        "norm": "decree",
        "source": "jo",
        "before": "L’article 6 du décret de 2017 est ",
        "highlight": "abrogé",
        "after": " et remplacé par une procédure de déclaration dématérialisée.",
        "languages": [
          "fr"
        ]
      }
    ],
    "explanation": "Un arrêté toujours en vigueur impose un modèle défini par une disposition abrogée, sans actualiser ce renvoi.",
    "suggestion": "Actualiser la référence du modèle et aligner la procédure sur la déclaration dématérialisée.",
    "correction": "Les relevés sont établis selon la procédure dématérialisée prévue à l’article 11 du décret de 2024."
  },
  {
    "id": "LG-036",
    "theme": "urban",
    "type": "conflict",
    "severity": "high",
    "title": "Installations temporaires : deux seuils incompatibles.",
    "date": "2026-08-21",
    "territory": "local",
    "status": "draft",
    "texts": [
      {
        "title": "Projet national sur les installations temporaires",
        "reference": "Projet de décret n° 2026-812 · art. 7",
        "date": "2026-08-21",
        "norm": "decree",
        "source": "jo",
        "before": "Les installations temporaires de ",
        "highlight": "moins de 40 m²",
        "after": " sont exemptées d’autorisation dans le périmètre concerné.",
        "languages": [
          "fr"
        ]
      },
      {
        "title": "Règlement de la commune de Valmont",
        "reference": "Délibération n° 2025-061 · art. 4",
        "date": "2025-06-06",
        "norm": "local",
        "source": "local",
        "before": "Dans le même périmètre, une autorisation est requise pour les installations temporaires de ",
        "highlight": "plus de 20 m²",
        "after": " sans autre distinction.",
        "languages": [
          "fr"
        ]
      }
    ],
    "explanation": "Entre 20 et 40 m², les dispositions prévoient des obligations différentes pour les mêmes installations et le même périmètre.",
    "suggestion": "Vérifier les compétences et dérogations locales, puis clarifier le seuil et le champ d’application du projet national.",
    "correction": "Le seuil applicable aux installations temporaires est harmonisé à 40 m², après vérification des compétences et dérogations locales."
  },
  {
    "id": "LG-035",
    "theme": "urban",
    "type": "gap",
    "severity": "high",
    "title": "Rénovation : une exception sans définition.",
    "date": "2026-01-15",
    "territory": "europe",
    "status": "draft",
    "texts": [
      {
        "title": "Cadre européen de rénovation",
        "reference": "Directive (UE) 2024/1628 · art. 9",
        "date": "2024-06-17",
        "norm": "european",
        "source": "eurlex",
        "before": "Les États précisent les critères applicables aux ",
        "highlight": "bâtiments à usage temporaire",
        "after": " avant de prévoir une exemption.",
        "languages": [
          "fr",
          "en"
        ]
      },
      {
        "title": "Projet de transposition sur la rénovation",
        "reference": "Projet de loi n° 326 · art. 16",
        "date": "2026-01-15",
        "norm": "law",
        "source": "jo",
        "before": "Les bâtiments à usage temporaire sont exemptés des obligations de rénovation, ",
        "highlight": "sans définition de la durée ou de l’usage",
        "after": " dans le présent projet.",
        "languages": [
          "fr"
        ]
      }
    ],
    "explanation": "Le projet reprend une exemption sans définir les critères de durée et d’usage attendus dans le scénario européen examiné.",
    "suggestion": "Définir la notion d’usage temporaire et préciser les justificatifs et la durée maximale de l’exemption.",
    "correction": "L’exemption vise les bâtiments utilisés au plus six mois, selon des critères d’usage et des justificatifs précisés par décret."
  },
  {
    "id": "LG-034",
    "theme": "urban",
    "type": "duplicate",
    "severity": "medium",
    "title": "Dossier d’urbanisme : la même étude demandée deux fois.",
    "date": "2022-10-04",
    "territory": "local",
    "status": "in_force",
    "texts": [
      {
        "title": "Pièces des demandes d’aménagement",
        "reference": "Décret n° 2022-1245 · art. 5",
        "date": "2022-10-04",
        "norm": "decree",
        "source": "jo",
        "before": "Le demandeur joint au dossier ",
        "highlight": "une étude d’impact paysager",
        "after": " décrivant les effets visuels du projet.",
        "languages": [
          "fr"
        ]
      },
      {
        "title": "Dossier local d’insertion paysagère",
        "reference": "Délibération n° 2023-018 · art. 2",
        "date": "2023-03-17",
        "norm": "local",
        "source": "local",
        "before": "Le dossier local comprend ",
        "highlight": "une étude d’impact paysager",
        "after": " présentant les mêmes éléments et le même périmètre.",
        "languages": [
          "fr"
        ]
      }
    ],
    "explanation": "Les deux procédures exigent une étude de même objet, même périmètre et même contenu, sans prévoir de réutilisation.",
    "suggestion": "Autoriser le réemploi de l’étude déjà fournie et harmoniser la liste des pièces attendues.",
    "correction": "L’étude d’impact paysager fournie au titre de la procédure nationale est réutilisable dans le dossier local."
  }
];
  const defaults = () => ({domains:[],norms:[],types:[],territories:[],statuses:[],period:'all',sources:[],include:'',exclude:'',language:'all',level:'all',customFrom:'',customTo:''});
  const examples = [
    {id:'health',icon:'heart',title:'Données de santé',subtitle:'Conservation des dossiers',text: "Projet d’arrêté fixant la durée de conservation des dossiers médicaux partagés à 5 ans chez les hébergeurs certifiés.",filters:{domains:['health'],norms:['decree','order'],period:'5'}},
    {id:'work',icon:'briefcase',title:'Durée du travail',subtitle:'Repos & temps de travail',text:'Vérifier la cohérence des textes sur le repos quotidien, le télétravail et le suivi du temps de travail.',filters:{domains:['work'],period:'10'}},
    {id:'urban',icon:'building',title:'Urbanisme',subtitle:'Normes nationales & locales',text:'Vérifier les règles d’urbanisme : autorisations des installations temporaires, rénovation et pièces des dossiers d’aménagement.',filters:{domains:['urban'],period:'5'}}
  ];
  const normalize = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const keywordList = value => value.split(',').map(word=>normalize(word.trim())).filter(Boolean);
  const issueContent = item => normalize([item.title,domains[item.theme],item.explanation,item.suggestion,...item.texts.flatMap(t=>[t.title,t.reference,t.before,t.highlight,t.after])].join(' '));
  function queryThemes(query) {
    const q = normalize(query);
    const topics = {health:/sante|dossier|medical|patient|donnee|conservation|confidentialite/,work:/travail|repos|salarie|horaire|employeur|teletravail/,urban:/urbanisme|installation|renovation|amenagement|batiment|paysager/};
    return Object.keys(topics).filter(key=>topics[key].test(q));
  }
  function filterIssues(query, filters) {
    const f = {...defaults(),...filters};
    const themes = queryThemes(query);
    const generic = /coherence|corpus|norme|juridique|texte|reglement|disposition/.test(normalize(query));
    const afterYear = ['all','custom'].includes(f.period)?null:2026-Number(f.period);
    return issues.filter(item=>{
      if(themes.length&&!themes.includes(item.theme))return false;
      if(!themes.length&&!generic&&!issueContent(item).includes(normalize(query.trim())))return false;
      if(f.domains.length&&!f.domains.includes(item.theme))return false;
      if(f.types.length&&!f.types.includes(item.type))return false;
      if(f.norms.length&&!item.texts.some(t=>f.norms.includes(t.norm)))return false;
      if(f.territories.length&&!f.territories.includes(item.territory))return false;
      if(f.statuses.length&&!f.statuses.includes(item.status))return false;
      if(f.sources.length&&!item.texts.some(t=>f.sources.includes(t.source)))return false;
      // La période porte sur le texte à examiner (date du signalement), et non sur chaque texte comparé.
      if(afterYear&&item.date < `${afterYear}-10-22`)return false;
      if(f.period==='custom'&&f.customFrom&&item.date<f.customFrom)return false;
      if(f.period==='custom'&&f.customTo&&item.date>f.customTo)return false;
      if(f.language!=='all'&&!item.texts.some(t=>t.languages.includes(f.language)))return false;
      const content=issueContent(item);
      return keywordList(f.include).every(word=>content.includes(word))&&!keywordList(f.exclude).some(word=>content.includes(word));
    });
  }
  const api={issues,examples,meta,domains,norms,sourceNames,territoryNames,statusNames,defaults,filterIssues,normalize,queryThemes};
  root.CiceroMock=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
