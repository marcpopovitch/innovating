# Leçons

- [2026-10-22] | `pkill -f "next dev …"` puis `kill` d'un PID non vérifié a arrêté le serveur d'un autre projet (Zzz-app, port 8000) | ne tuer que des PID lancés dans la session, vérifier `ps -p <pid> -o command` AVANT tout kill, cibler le port exact (`lsof -ti :3100`).
- [2026-10-22] | Le hook de sécurité bloque toute écriture de fichier `.env*` | documenter les variables dans le README / le code, ne jamais créer de `.env` ni de `.env.example`.

[2026-10-22] | Pipeline réel jamais lancé de bout en bout : les chercheurs OpenAI plantaient (outils + reasoning_effort refusés sur chat/completions), masqué par un « aucune irrégularité » | Toujours lancer une vraie analyse et lire les événements « erreur » avant de dire que la chaîne est branchée

[2026-10-22] | `npx prettier --write` lancé sur lexguard alors que le projet n'a pas Prettier : tout un fichier reformaté | Vérifier la config du projet avant tout formateur ; sinon ne pas formater

[2026-10-22] | Nouvelle route testée seulement sur une copie : le serveur de dev de l'utilisateur gardait d'anciens modules serveur (« upsert is not a function ») et un dossier glissé arrivait comme un faux fichier | Vérifier sur le serveur réel de l'utilisateur (port 3000) ; si une fonction exportée « n'existe pas », relancer le serveur de dev ; gérer les dossiers (webkitGetAsEntry) dans tout glisser-déposer

[2026-10-22] | Coupure réseau pendant une analyse : tous les chercheurs en « fetch failed », et pourtant conclusion « aucune irrégularité » ; débit mesuré sur /models (liste énorme) pris pour de la latence | Appels aux modèles retentés (fetchRetry) ; une analyse dont aucun chercheur n'aboutit passe en erreur ; mesurer la latence au premier octet sur un petit appel, pas sur un gros téléchargement
