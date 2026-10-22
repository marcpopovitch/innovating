# Leçons

- [2026-10-22] | `pkill -f "next dev …"` puis `kill` d'un PID non vérifié a arrêté le serveur d'un autre projet (Zzz-app, port 8000) | ne tuer que des PID lancés dans la session, vérifier `ps -p <pid> -o command` AVANT tout kill, cibler le port exact (`lsof -ti :3100`).
- [2026-10-22] | Le hook de sécurité bloque toute écriture de fichier `.env*` | documenter les variables dans le README / le code, ne jamais créer de `.env` ni de `.env.example`.
