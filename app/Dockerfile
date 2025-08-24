FROM oven/bun:latest AS builder
WORKDIR /app
COPY package.json bun.lock tsconfig.json ./
# Enforce frozen lockfile: use the committed bun.lock exactly
RUN bun install --production --frozen-lockfile
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