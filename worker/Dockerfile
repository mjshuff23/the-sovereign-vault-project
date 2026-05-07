FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package.json
COPY package-lock.json package-lock.json
COPY tsconfig.base.json tsconfig.base.json
COPY worker/package.json worker/package.json
RUN npm ci --workspace worker --include-workspace-root

FROM deps AS build
COPY worker worker
RUN npm run build -w worker

FROM node:22-bookworm-slim AS prod-deps
WORKDIR /app
COPY package.json package.json
COPY package-lock.json package-lock.json
COPY worker/package.json worker/package.json
COPY frontend/package.json frontend/package.json
RUN npm ci --workspace worker --include-workspace-root --omit=dev

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update \
  && apt-get install -y --no-install-recommends curl \
  && rm -rf /var/lib/apt/lists/*
COPY --chown=node:node package.json package.json
COPY --chown=node:node tsconfig.base.json tsconfig.base.json
COPY --from=prod-deps --chown=node:node /app/node_modules node_modules
COPY --from=build --chown=node:node /app/worker worker
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
  CMD curl -fsS http://127.0.0.1:4000/health || exit 1
CMD ["npm", "run", "start", "-w", "worker"]
