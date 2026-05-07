FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package.json
COPY package-lock.json package-lock.json
COPY tsconfig.base.json tsconfig.base.json
COPY worker/package.json worker/package.json
RUN npm install --workspace worker --include-workspace-root

FROM deps AS build
COPY worker worker
RUN npm run build -w worker

FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json package.json
COPY tsconfig.base.json tsconfig.base.json
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/worker worker
ENV NODE_ENV=production
EXPOSE 4000
CMD ["npm", "run", "start", "-w", "worker"]
