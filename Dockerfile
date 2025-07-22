# Use the official Deno image for a secure and minimal base
FROM denoland/deno:1.44.4

# The port that your application listens to.
EXPOSE 8000

WORKDIR /app

# Prefer not to run as root.
USER deno

# Cache dependencies before copying the rest of the source code.
# This leverages Docker's layer caching to speed up subsequent builds.
COPY deno.jsonc .
COPY app/fresh.gen.ts ./app/
RUN deno cache app/main.ts --config deno.jsonc

# Copy the rest of the application code.
COPY . .

# Run the main.ts file for production.
# Note: The --unstable-kv flag is included as per your project's setup.
CMD ["run", "--allow-read", "--allow-env", "--allow-net", "--allow-sys", "--allow-write", "--allow-run", "--unstable-kv", "app/main.ts"]
