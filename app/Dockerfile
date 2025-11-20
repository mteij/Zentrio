FROM oven/bun:latest AS base
WORKDIR /app

# Install git and npm for cloning stremio-web
RUN apt-get update && apt-get install -y git npm && rm -rf /var/lib/apt/lists/*

FROM base AS builder
WORKDIR /app
COPY package.json bun.lock tsconfig.json ./
# Enforce frozen lockfile: use the committed bun.lock exactly
RUN bun install --production --frozen-lockfile

# Copy scripts and patches needed for stremio-web build
COPY scripts ./scripts
COPY stremio-patches ./stremio-patches
# Copy source code including static assets
COPY src ./src

# Build stremio-web and main application
RUN bun run build

FROM oven/bun:latest AS runtime
WORKDIR /app

# Install curl for healthcheck
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/dist/index.html ./index.html
COPY --from=builder /app/package.json ./package.json

# Copy stremio-web build artifacts if they exist
RUN mkdir -p ./data && \
    if [ -d "/app/data" ]; then \
        find /app/data -mindepth 1 -maxdepth 1 -exec cp -r {} ./data/ \; ; \
    fi

ENV NODE_ENV=production
# Default port is 3000; can be overridden via .env or docker run --env PORT=...
ENV PORT=3000
EXPOSE 3000
CMD ["sh","-c","PORT=${PORT:-3000} bun run dist/index.js"]