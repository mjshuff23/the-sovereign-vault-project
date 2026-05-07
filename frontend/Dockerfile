FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package.json
COPY package-lock.json package-lock.json
COPY tsconfig.base.json tsconfig.base.json
COPY frontend/package.json frontend/package.json
RUN npm install --workspace frontend --include-workspace-root

FROM deps AS build
COPY frontend frontend
RUN npm run build -w frontend

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package.json
COPY tsconfig.base.json tsconfig.base.json
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/frontend frontend
EXPOSE 3000
CMD ["npm", "run", "start", "-w", "frontend"]
