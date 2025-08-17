# --- Build Stage ---
FROM denoland/deno:latest AS builder
WORKDIR /
COPY app/ /app/
COPY deno.jsonc deno.lock* ./
RUN deno cache app/main.ts

# --- Production Stage ---
FROM denoland/deno:latest
WORKDIR /
COPY --from=builder /deno-dir /deno-dir
COPY --from=builder /app /app
COPY deno.jsonc deno.lock* ./
EXPOSE 8000
CMD ["run", "--allow-read", "--allow-env", "--allow-net", "--allow-sys", "--allow-write", "--allow-run", "--unstable-kv", "app/main.ts"]