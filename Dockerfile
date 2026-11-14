# Winnza : une seule image pour le site (SvelteKit, rendu serveur) et la collecte (socle).
#   site     : node web/build                        (variables : ORIGIN, WINNZA_DB, WINNZA_ADMIN_TOKEN)
#   collecte : node server/dist/cli.js collect /data/energy.db
FROM node:26.13.1-trixie-slim AS build
# git : le moteur de plugins partagé s'installe depuis GitHub (version figée) ; outils de compilation :
# au cas où better-sqlite3 n'aurait pas de binaire précompilé pour cette version de Node
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates python3 make g++ && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY server/package.json server/package-lock.json server/
RUN cd server && npm ci
COPY server/ server/
# les tests lisent les vraies déclarations : ce qui part en production est ce qui est éprouvé
COPY declarations/ declarations/
RUN cd server && npm run build && npm test
COPY web/package.json web/package-lock.json web/
RUN cd web && npm ci
COPY web/ web/
RUN cd web && npm run check && npm run build
# seules les dépendances d'exécution partent dans l'image finale
RUN cd server && npm prune --omit=dev && cd ../web && npm prune --omit=dev

FROM node:26.13.1-trixie-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/server/package.json server/
COPY --from=build /app/server/dist server/dist
COPY --from=build /app/server/node_modules server/node_modules
COPY --from=build /app/web/package.json web/
COPY --from=build /app/web/build web/build
COPY --from=build /app/web/node_modules web/node_modules
COPY declarations/ declarations/
RUN mkdir -p /data && chown node:node /data
USER node
ENV PORT=3000 HOST=0.0.0.0 WINNZA_DB=/data/energy.db
EXPOSE 3000
CMD ["node", "web/build"]
