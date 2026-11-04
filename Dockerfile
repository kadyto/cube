# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
# Optional CA only for restricted development environments; not stored in the image.
RUN --mount=type=secret,id=proxy_ca \
    if [ -f /run/secrets/proxy_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca; fi; \
    npm ci --strict-ssl=true
COPY index.html tsconfig.json vite.config.ts ./
COPY src ./src
COPY public ./public
COPY shared ./shared
RUN npm run build && npm prune --omit=dev

FROM node:24-bookworm-slim AS runtime
LABEL org.opencontainers.image.title="Cube" \
      org.opencontainers.image.description="Tu espacio de speedcubing" \
      org.opencontainers.image.source="https://github.com/kadyto/cube" \
      org.opencontainers.image.version="1.0.0"
ENV NODE_ENV=production PORT=3000 DATABASE_PATH=/data/cube.sqlite
WORKDIR /app
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json ./
COPY --chown=node:node server ./server
COPY --chown=node:node shared ./shared
RUN mkdir /data && chown node:node /data
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:3000/healthz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "server/index.js"]
