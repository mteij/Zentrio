# Use the official Deno image for a secure and minimal base
FROM denoland/deno:1.44.4

# The port that your application listens to.
EXPOSE 8000

WORKDIR /app

# Prefer not to run as root.
USER deno

# Copy the contents of the local 'app' directory into the container's working directory '/app'
COPY ./app .

# Cache dependencies using the copied files.
# The --config flag is crucial for Deno to find the import_map.
RUN deno cache --config ./deno.jsonc main.ts

# Run the main.ts file for production.
# Note: The --unstable-kv flag is included as per your project's setup.
CMD ["run", "--allow-read", "--allow-env", "--allow-net", "--allow-sys", "--allow-write", "--allow-run", "--unstable-kv", "main.ts"]
