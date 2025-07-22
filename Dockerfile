# Use an official Deno image.
FROM denoland/deno:2.4.2

# Set the working directory inside the container.
WORKDIR /app

# Copy the dependency configuration and all application source code.
COPY app/ .

# Define empty environment variables.
ENV MONGO_URI="verycooluri" \
    RESEND_API_KEY="verycoolapikey"

# Generate fresh.gen.ts. This requires --allow-read, --allow-write for file generation.
RUN deno run --allow-read --allow-env --allow-net --allow-sys --allow-write --allow-run --unstable-kv dev.ts build

# Cache all dependencies for the application.
RUN deno cache --config ./deno.jsonc main.ts

# Expose the port the app runs on.
EXPOSE 8000

# Define the command to run the application.
CMD ["run", "--allow-read", "--allow-env", "--allow-net", "--allow-sys", "--allow-write", "--allow-run", "--unstable-kv", "main.ts"]
