# StremioHub - Profile Selector Overlay

![StremioHub Banner](https://placehold.co/1200x440/141414/00D4B8?text=StremioHub)

<p align="center">
  <a href="https://deno.land">
    <img src="https://img.shields.io/badge/powered%20by-Deno-black?style=for-the-badge&logo=deno" alt="Powered by Deno">
  </a>
   <a href="https://fresh.deno.dev">
    <img src="https://img.shields.io/badge/built%20with-Fresh-green?style=for-the-badge&logo=deno" alt="Built with Fresh">
  </a>
  <a href="https://opensource.org/licenses/MIT">
    <img src="https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge" alt="License: MIT">
  </a>
</p>

A secure, modern, Netflix-inspired user selection overlay for the Stremio Web UI, rebuilt from the ground up with Deno and the Fresh web framework.

This project uses MongoDB for data storage and a custom session-based authentication system.

---

## ✨ Features

*   **🎬 Netflix-Inspired UI:** A familiar and intuitive profile selection screen.
*   **🔒 Secure Authentication:** Custom-built, secure email magic-link authentication.
*   **👤 Multi-Profile Support:** Manage multiple Stremio profiles, stored securely in MongoDB.
*   **⚡️ Blazing Fast:** Built with Fresh, featuring server-side rendering and an islands architecture for optimal performance.
*   **🦕 Deno Native:** Runs on the Deno runtime, offering a secure and simple development experience with no `node_modules`.
*   **☁️ Edge-Ready:** Designed to be deployed globally on platforms like Deno Deploy.

---

## 🛠️ Tech Stack

<p align="left">
  <a href="https://deno.land/" target="_blank" rel="noreferrer"><img src="https://raw.githubusercontent.com/devicons/devicon/master/icons/deno/deno-original-wordmark.svg" alt="deno" width="40" height="40"/></a>
  <a href="https://fresh.deno.dev/" target="_blank" rel="noreferrer"><img src="https://fresh.deno.dev/logo.svg" alt="fresh" width="40" height="40"/></a>
  <a href="https://preactjs.com/" target="_blank" rel="noreferrer"><img src="https://raw.githubusercontent.com/devicons/devicon/master/icons/preact/preact-original.svg" alt="preact" width="40" height="40"/></a>
  <a href="https://www.typescriptlang.org/" target="_blank" rel="noreferrer"><img src="https://raw.githubusercontent.com/devicons/devicon/master/icons/typescript/typescript-original.svg" alt="typescript" width="40" height="40"/></a>
  <a href="https://tailwindcss.com/" target="_blank" rel="noreferrer"><img src="https://www.vectorlogo.zone/logos/tailwindcss/tailwindcss-icon.svg" alt="tailwind" width="40" height="40"/></a>
  <a href="https://www.mongodb.com/" target="_blank" rel="noreferrer"><img src="https://raw.githubusercontent.com/devicons/devicon/master/icons/mongodb/mongodb-original-wordmark.svg" alt="mongodb" width="40" height="40"/></a>
</p>

---

## 🚀 Getting Started

### Prerequisites

*   [Deno](https://deno.land/manual/getting_started/installation) version 1.30.0 or higher.

### Running Locally

1.  **Clone the repository:**
    ```sh
    git clone https://github.com/MichielEijpe/StremioHub.git
    cd StremioHub
    ```

2.  **Create your environment file:**
    Copy the `.env.example` to a new file named `.env` and fill in your credentials for Resend and MongoDB.

3.  **Configure MongoDB Atlas IP Access:**
    In your MongoDB Atlas dashboard, navigate to **Network Access** and add your current IP address or allow access from anywhere (`0.0.0.0/0`) for development.

4.  **Navigate into the app directory:**
    ```sh
    cd app
    ```

5.  **Start the development server:**
    ```sh
    deno task start
    ```
    This will start the server on `http://localhost:8000`. The app will automatically reload when you make changes.

> **Troubleshooting:** If you encounter module errors after changing dependencies, run `deno task clean` before starting the server to ensure a clean build.

---

## ☁️ Deployment

This project is optimized for deployment on [Deno Deploy](https://deno.com/deploy).

1.  Push your project to a GitHub repository.
2.  Sign up for Deno Deploy and connect your GitHub account.
3.  Create a new project, select your repository, and set the **Root** to `app`.
4.  Set your `MONGO_URI` and `RESEND_API_KEY` as environment variables in the Deno Deploy project settings.
5.  Deno Deploy will automatically detect the `main.ts` file and deploy your application.

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!

---

## 📜 License

This project is licensed under the **MIT License**.

---

# StremioHub

A multi-profile manager for Stremio.

## Running with Docker

You can run this application using Docker. First, build the image yourself or use a pre-built image from the GitHub Container Registry.

### Prerequisites

- Docker and Docker Compose installed.
- A `.env` file with your credentials, or the environment variables ready.

Create a `.env` file in the same directory where you will run the `docker-compose` command:

```env
# .env
MONGO_URI="your_mongodb_connection_string"
RESEND_API_KEY="your_resend_api_key"
```

### Using `docker run`

```sh
# Replace YOUR_GITHUB_USERNAME with your actual GitHub username
docker run -d \
  -p 8000:8000 \
  -e MONGO_URI="your_mongodb_connection_string" \
  -e RESEND_API_KEY="your_resend_api_key" \
  --name stremiohub \
  ghcr.io/YOUR_GITHUB_USERNAME/StremioHub:latest
```

### Using `docker-compose` (Recommended)

This is the recommended method for running the application locally.

1.  Create a `docker-compose.yml` file with the following content:

    ```yaml
    # docker-compose.yml
    version: '3.8'

    services:
      stremiohub:
        # Replace YOUR_GITHUB_USERNAME with your actual GitHub username
        image: ghcr.io/YOUR_GITHUB_USERNAME/StremioHub:latest
        container_name: stremiohub
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

The application will be available at `http://localhost:8000`.
