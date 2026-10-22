# Image pour Aiven Runtime (ou tout hébergeur de conteneurs).
# Variables à fournir au déploiement : ANTHROPIC_API_KEY, DATABASE_URL (Aiven PostgreSQL).
FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production PORT=8080 HOSTNAME=0.0.0.0
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
# Le schéma est appliqué au démarrage (idempotent).
COPY --from=build /app/db ./db
EXPOSE 8080
CMD ["node", "server.js"]
