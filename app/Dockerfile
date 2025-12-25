FROM oven/bun:latest AS base
WORKDIR /app

# Install git and npm for cloning stremio-web
RUN apt-get update && apt-get install -y git npm && rm -rf /var/lib/apt/lists/*

FROM base AS builder
WORKDIR /app
COPY package.json bun.lock tsconfig.json index.html vite.config.ts tailwind.config.js postcss.config.js ./
# Enforce frozen lockfile: use the committed bun.lock exactly
RUN bun install --no-save

# Copy scripts and patches needed for stremio-web build
COPY scripts ./scripts
RUN if [ -d stremio-patches ]; then cp -r stremio-patches ./stremio-patches; fi
# Copy source code including static assets
COPY src ./src
COPY public ./public

# Build server (creates dist/index.js)
RUN bun build src/index.ts --outdir ./dist --target bun --minify

# Copy static assets to dist
RUN mkdir -p dist/static && cp -r public/static/* dist/static/

# Build SPA (creates dist/index.html and other frontend assets)
RUN bun run vite build

FROM oven/bun:latest AS runtime
WORKDIR /app

# Install curl for healthcheck
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/dist/index.html ./index.html
COPY --from=builder /app/package.json ./package.json

# Copy local data directory if it exists
RUN if [ -d data ]; then cp -r data ./data; fi

ENV NODE_ENV=production
# Default port is 3000; can be overridden via .env or docker run --env PORT=...
ENV PORT=3000
EXPOSE 3000
CMD ["sh","-c","PORT=${PORT:-3000} bun run dist/index.js"]