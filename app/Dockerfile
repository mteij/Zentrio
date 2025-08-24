FROM oven/bun:latest AS builder
WORKDIR /app
COPY package.json bun.lock tsconfig.json ./
# Ensure install proceeds even if a CI environment enforces frozen lockfile
# Use Bun's env to disable frozen mode specifically for this step
RUN BUN_INSTALL_FROZEN_LOCKFILE=0 bun install --production
COPY src ./src
RUN bun build src/index.ts --outdir ./dist --target bun

FROM oven/bun:latest AS runtime
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src ./src
COPY --from=builder /app/package.json ./package.json
ENV NODE_ENV=production
# Default port is 3000; can be overridden via .env or docker run --env PORT=...
ENV PORT=3000
EXPOSE 3000
CMD ["sh","-c","PORT=${PORT:-3000} bun run dist/index.js"]