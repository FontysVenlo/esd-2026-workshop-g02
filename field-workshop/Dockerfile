FROM node:22-alpine AS frontend
WORKDIR /build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN corepack enable && corepack prepare pnpm@11.25.0 --activate
RUN pnpm install --frozen-lockfile --ignore-scripts
COPY build.mjs ./
COPY src/ ./src/
COPY public/ ./public/
RUN node build.mjs

FROM node:22-alpine
WORKDIR /app
COPY services/ ./services/
COPY --from=frontend /build/build/ ./build/
COPY src/shared/ ./src/shared/
COPY content/ ./content/
COPY docs/ ./docs/
USER node

CMD ["node", "services/storefront.mjs"]
