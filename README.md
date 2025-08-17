# Zentrio App

A high-performance streaming application built with Hono and Bun.js, featuring Better Auth integration and Stremio proxy functionality.

## Features

- **High Performance**: Built with Hono framework and Bun runtime
- **Authentication**: Better Auth integration with support for email/password, OAuth, and magic links
- **Streaming Support**: Built-in streaming capabilities using Hono's streaming helpers
- **Stremio Proxy**: Proxy functionality for Stremio integration
- **Security**: CORS, security headers, and rate limiting middleware
- **TypeScript**: Full TypeScript support with type safety

## Quick Start

1. **Install dependencies**:
   ```bash
   bun install
   ```

2. **Set up environment variables**:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start development server**:
   ```bash
   bun run dev
   ```

4. **Visit**: http://localhost:3000

## Scripts

- `bun run dev` - Start development server with hot reload
- `bun run start` - Start production server
- `bun run build` - Build for production
- `bun run preview` - Preview production build
- `bun run type-check` - Run TypeScript type checking

## API Endpoints

- `GET /api` - API information and available endpoints
- `GET /api/health` - Health check endpoint
- `GET /api/stream` - Streaming example endpoint
- `ALL /stremio/*` - Stremio proxy endpoints

## Environment Variables

See `.env.example` for all available configuration options:

- `DATABASE_URL` - Database connection string
- `AUTH_SECRET` - Secret key for authentication
- `PORT` - Server port (default: 3000)
- `APP_URL` - Public base URL used in magic links (defaults to http://localhost:PORT)
- `NODE_ENV` - Environment (development/production)
- `STREMIO_API_URL` - Stremio API endpoint
- `CORS_ORIGINS` - Allowed CORS origins

Environment variables are initialized at startup via [src/config/env.ts](app/src/config/env.ts) which loads the repository-root .env if present.

## Development

This project uses:
- **Bun** - JavaScript runtime and package manager
- **Hono** - Web framework
- **Better Auth** - Authentication library
- **TypeScript** - Type safety

## Production Deployment

1. Build the application:
   ```bash
   bun run build
   ```

2. Set production environment variables

3. Start the server:
   ```bash
   bun run preview
   ```

## License

MIT
