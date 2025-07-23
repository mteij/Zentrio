# --- Build Stage ---
FROM denoland/deno:latest AS builder
WORKDIR /app
COPY app/ .
# Copy .env from the root into the build context (for dev and prod)
COPY .env ../.env
RUN deno cache main.ts

# --- Production Stage ---
FROM denoland/deno:latest
WORKDIR /app
COPY --from=builder /deno-dir /deno-dir
COPY --from=builder /app .
# Copy .env from the root into the container root (so ../.env from /app is /app/../.env = /)
COPY .env /app/../.env
EXPOSE 8000
CMD ["run", "--allow-read", "--allow-env", "--allow-net", "--allow-sys", "--allow-write", "--allow-run", "--unstable-kv", "app/main.ts"]