# Use an official Deno image.
FROM denoland/deno:2.4.2

# Set the working directory inside the container.
WORKDIR /app

# Copy the dependency configuration and all application source code.
# The source code is needed to generate the fresh manifest.
COPY app/ .

# Generate fresh.gen.ts. This requires --allow-read, --allow-write for file generation,
# and --allow-env for loading .env in dev.ts.
RUN deno run --allow-read --allow-env --allow-net --allow-sys --allow-write --allow-run --unstable-kv dev.ts build

# Cache all dependencies for the application.
# This will download and cache all modules specified in the import map and used by main.ts.
RUN deno cache --config ./deno.jsonc main.ts

# Expose the port the app runs on.
EXPOSE 8000

# Define the command to run the application.
# This command will be executed when the container starts.
# It includes all necessary permissions for the application to run.
CMD ["run", "--allow-read", "--allow-env", "--allow-net", "--allow-sys", "--allow-write", "--allow-run", "--unstable-kv", "main.ts"]