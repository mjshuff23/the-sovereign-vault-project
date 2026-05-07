FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package.json
COPY package-lock.json package-lock.json
COPY tsconfig.base.json tsconfig.base.json
COPY frontend/package.json frontend/package.json
RUN npm ci --workspace frontend --include-workspace-root

FROM deps AS build
COPY frontend frontend
RUN npm run build -w frontend
RUN npm prune --omit=dev --workspaces --include-workspace-root

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --chown=node:node package.json package.json
COPY --chown=node:node tsconfig.base.json tsconfig.base.json
COPY --from=build --chown=node:node /app/node_modules node_modules
COPY --from=build --chown=node:node /app/frontend frontend
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["npm", "run", "start", "-w", "frontend"]
