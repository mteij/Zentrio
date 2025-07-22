# Use the official Deno image for a secure and minimal base
FROM denoland/deno:1.44.4

# The port that your application listens to.
EXPOSE 8000

WORKDIR /app

# Prefer not to run as root.
USER deno

# Copy all application files from the build context to the current directory (/app)
COPY . .

# Cache dependencies using the copied files.
# This is less efficient for layer caching but more robust.
RUN deno cache app/main.ts --config deno.jsonc

# Run the main.ts file for production.
# Note: The --unstable-kv flag is included as per your project's setup.
CMD ["run", "--allow-read", "--allow-env", "--allow-net", "--allow-sys", "--allow-write", "--allow-run", "--unstable-kv", "app/main.ts"]
# Note: The --unstable-kv flag is included as per your project's setup.
CMD ["run", "--allow-read", "--allow-env", "--allow-net", "--allow-sys", "--allow-write", "--allow-run", "--unstable-kv", "app/main.ts"]
