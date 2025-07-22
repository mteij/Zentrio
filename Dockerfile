# Use the official Deno image for a secure and minimal base
# Updated to the user-specified version
FROM denoland/deno:2.4.2

WORKDIR /app

# Prefer not to run as root.
USER deno

# Copy all project files from the build context to the current directory (/app)
COPY . .

# Generate the Fresh manifest file. This is crucial for production builds.
# This command scans your routes/ and islands/ directories and creates fresh.gen.ts.
# We use an older version of Fresh here to match your project's dependencies.
RUN deno run -A https://deno.land/x/fresh@1.6.8/gen.ts .

# Cache all dependencies for the application.
RUN deno cache --config ./deno.jsonc app/main.ts

# Run the main.ts file for production.
# Note: The --unstable-kv flag is included as per your project's setup.
CMD ["run", "--allow-read", "--allow-env", "--allow-net", "--allow-sys", "--allow-write", "--allow-run", "--unstable-kv", "app/main.ts"]
