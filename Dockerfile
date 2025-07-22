# --- Build Stage ---
FROM denoland/deno:latest AS builder
WORKDIR /app
COPY app/ .
RUN deno cache main.ts

# --- Production Stage ---
FROM denoland/deno:latest
WORKDIR /app
COPY --from=builder /deno-dir /deno-dir
COPY --from=builder /app .
EXPOSE 8000
CMD ["run", "--allow-read", "--allow-env", "--allow-net", "--allow-sys", "--allow-write", "--allow-run", "--unstable-kv", "main.ts"]