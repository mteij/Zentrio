<p align="left">
  <img src="app/static/icons/icon-192.png" alt="Zentrio Icon" width="48" height="48"/>
</p>

# Zentrio - Profile Selector Overlay

A secure, modern, Netflix-inspired user selection overlay for the Zentrio Web UI, rebuilt with Deno and the Fresh web framework.

- **Netflix-Inspired UI:** Familiar, intuitive profile selection.
- **Secure Authentication:** Magic-link email login.
- **Multi-Profile Support:** Profiles stored in MongoDB.
- **Fast & Modern:** Built with Fresh (Preact, Islands architecture), Deno native.
- **Edge-Ready:** Deployable globally (Deno Deploy).

---

## Tech Stack

- **Deno** (runtime)
- **Fresh** (framework)
- **Preact**
- **TypeScript**
- **Tailwind CSS**
- **MongoDB**

---

## Getting Started

**Prerequisites:**  
- [Deno](https://deno.land/manual/getting_started/installation) v1.30.0+

**Quick Start:**
```sh
git clone https://github.com/MichielEijpe/Zentrio.git
cd Zentrio/app
cp ../.env.example ../.env   # Edit with your MongoDB/Resend credentials
deno task start
```
App runs at [http://localhost:8000](http://localhost:8000).

> If you see module errors after changing dependencies, run `deno task clean` before restarting.

---

## Deployment

Optimized for [Deno Deploy](https://deno.com/deploy):

1. Push to GitHub.
2. Connect repo in Deno Deploy, set root to `app`.
3. Add `MONGO_URI` and `RESEND_API_KEY` as environment variables.
4. Deploy.

---

## Docker

**.env file required** (see `.env.example`):

```env
MONGO_URI="your_mongodb_connection_string"
RESEND_API_KEY="your_resend_api_key"
```

**docker-compose (recommended):**
```yaml
# docker-compose.yml
version: '3.8'
services:
  zentrio:
    image: ghcr.io/MichielEijpe/Zentrio:latest
    container_name: zentrio
    restart: unless-stopped
    ports:
      - "8000:8000"
    env_file:
      - .env
```
```sh
docker-compose up -d
```

**docker run:**
```sh
docker run -d -p 8000:8000 --env-file .env --name zentrio ghcr.io/michieleijpe/zentrio:latest
```

---

## Settings

Visit `/settings` in your browser for experimental features and userscript toggles.

---

## License

MIT License

---

## Contributing

Contributions, issues, and feature requests are welcome!
## Running with Docker

You can run this application using a pre-built Docker image from the GitHub Container Registry.

### Prerequisites

- Docker and Docker Compose installed.
- A `.env` file with your credentials, or the environment variables ready.

Create a `.env` file in the project root:

```env
# .env
MONGO_URI="your_mongodb_connection_string"
RESEND_API_KEY="your_resend_api_key"
```

### Using `docker-compose` (Recommended)

This is the easiest method for running the application locally.

1.  Create a `docker-compose.yml` file in the project root with the following content:

    ```yaml
    # docker-compose.yml
    version: '3.8'

    services:
      zentrio:
        image: ghcr.io/MichielEijpe/Zentrio:latest
        container_name: zentrio
        restart: unless-stopped
        ports:
          - "8000:8000"
        env_file:
          - .env
    ```

2.  Make sure you have a `.env` file in the same directory (see above).

3.  Run the application:
    ```sh
    docker-compose up -d
    ```

### Using `docker run`

If you prefer not to use `docker-compose`, you can run the image manually.

1.  Pull the latest image:
    ```sh
    docker pull ghcr.io/michieleijpe/zentrio:latest
    ```

2.  Run the container:
    ```sh
    docker run -d \
      -p 8000:8000 \
      --env-file .env \
      --name zentrio \
      ghcr.io/michieleijpe/zentrio:latest
    ```

The application will be available at `http://localhost:8000`.

---

## ⚙️ Settings

Visit `/settings` in your browser to access experimental features and toggle the addon order userscript.

---
