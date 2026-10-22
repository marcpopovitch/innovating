# Analyse = déposer un document (plus de questions)

Objectif : l'écran d'analyse ne sert qu'à déposer des documents ; chaque document déposé est contrôlé tout de suite.

- [x] `app/api/fichier` : renvoyer la liste des documents lus (`actes: [{name, text}]`) au lieu d'un texte collé
- [x] `components/document-drop.tsx` (remplace chat-composer) : grande zone de dépôt + dépôt n'importe où sur la page,
      boutons « Choisir des fichiers » / « Choisir un dossier », exemple, choix du modèle ; plus de champ texte
- [x] `app/app/analyse/page.tsx` : supprimer prompt, cadrage (questions), suggestions ; chaque document → une analyse
      en mode contrôle (cadrage par défaut : droit en vigueur, France + UE), max 10 par dépôt ; la 1re s'affiche
- [x] Vérifier dans le navigateur : dépôt d'un .txt → analyse lancée et terminée (1 conflit trouvé)
- [ ] Non vérifié à l'écran : dépôt d'un vrai dossier (l'automatisation ne sait pas glisser un dossier) ; le dossier CE passe via l'API
