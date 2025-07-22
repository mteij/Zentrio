# Use the official Deno image for a secure and minimal base
# Updated to the user-specified version
FROM denoland/deno:2.4.2

# The port that your application listens to.
EXPOSE 8000

WORKDIR /app

# Prefer not to run as root.
USER deno

# Copy all project files from the build context to the current directory (/app)
COPY . .

# Cache all dependencies for the application.
# The --config flag is crucial for Deno to find the import_map.
RUN deno cache --config ./deno.jsonc app/main.ts

# Run the main.ts file for production.
# Note: The --unstable-kv flag is included as per your project's setup.
CMD ["run", "--allow-read", "--allow-env", "--allow-net", "--allow-sys", "--allow-write", "--allow-run", "--unstable-kv", "app/main.ts"]