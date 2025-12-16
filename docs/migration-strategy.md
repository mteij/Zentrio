# Advanced Migration Strategy: SSR to Client-Side SPA

This document outlines the strategy for migrating Zentrio from a Server-Side Rendered (SSR) Hono application to a Client-Side Rendered (CSR) Single Page Application (SPA) powered by React and Vite.

## 🎯 Objective

To enable a unified codebase that supports:
1.  **Desktop (Windows/Linux/macOS):** Using Tauri with a bundled backend sidecar.
2.  **Mobile (Android/iOS):** Using Tauri with a remote backend (or eventual local Rust logic).
3.  **Web:** Using the same SPA served by the backend.

## 🏗️ Architecture

### Current (Legacy)
*   **Runtime:** Bun
*   **Framework:** Hono (Server)
*   **Rendering:** SSR (Hono JSX)
*   **Routing:** Server-side (Hono)
*   **Data:** Direct DB access in route handlers.

### Target (SPA)
*   **Runtime:** Browser (Client) / Bun (API Server)
*   **Framework:** React (Client) / Hono (API Server)
*   **Rendering:** CSR (Vite)
*   **Routing:** Client-side (React Router)
*   **Data:** API calls (`fetch`) to backend.

## 🚀 Migration Phases

### Phase 1: Foundation (✅ Completed)
*   Installed React, Vite, and React Router.
*   Configured `vite.config.ts` to proxy API requests to the backend.
*   Created SPA entry points (`index.html`, `src/main.tsx`).
*   Updated `tsconfig.json` to use standard `react-jsx`.
*   Refactored `Layout.tsx` to be SPA-compatible (removed `<html>`/`<body>` tags).
*   Updated build scripts to compile the SPA.

### Phase 2: Component Migration (✅ Completed)
*   **Goal:** Convert Hono JSX components to standard React components.
*   **Action:**
    *   Refactored `LandingPage.tsx` to use React hooks for animations and auth logic.
    *   Refactored `ProfilesPage.tsx` to fetch profiles from API.
    *   Refactored `StreamingHome.tsx`, `StreamingDetails.tsx`, `StreamingPlayer.tsx`, `StreamingExplore.tsx`, `StreamingLibrary.tsx`, `StreamingSearch.tsx`, `StreamingCatalog.tsx`.
    *   Refactored `SettingsPage.tsx` and `ExploreAddonsPage.tsx`.
    *   Moved static assets to `app/public/static` for correct serving by Vite.

### Phase 3: Routing Migration (✅ Completed)
*   **Goal:** Move routing logic from `src/routes/views.ts` to `src/main.tsx`.
*   **Action:**
    *   Defined routes in `src/main.tsx` using `<Route path="..." element={<Component />} />`.
    *   Removed SSR handlers from `src/routes/views.ts` to prevent conflicts.
    *   Configured `src/index.ts` to serve the SPA (`index.html`) for all non-API routes in production.

### Phase 4: Data Fetching (✅ Completed)
*   **Goal:** Replace SSR data injection (props) with Client-Side data fetching.
*   **Action:**
    *   Created API endpoints in `src/routes/api/streaming.ts` for dashboard, details, filters, and catalogs.
    *   Created API endpoints in `src/routes/api/lists.ts` for library management.
    *   Updated components to fetch data from these endpoints.

### Phase 5: Polish & Feature Parity (✅ Completed)
*   **Goal:** Ensure all features from the SSR version are fully functional in the SPA.
*   **Action:**
    *   **Settings Page:** Fully implemented all tabs (Account, Appearance, Addons, Streaming, Danger Zone) in `SettingsPage.tsx` using new subcomponents (`AppearanceSettings`, `StreamingSettings`, `DangerZoneSettings`, `AddonManager`).
    *   **Player:** Refactored `StreamingPlayer.tsx` to use a custom `usePlayer` hook and React state for video playback, HLS support, and custom UI controls, replacing legacy script injection.
    *   **Streaming UI:** Created a reusable `StreamingRow` component for horizontal scrolling lists with drag-to-scroll and arrow navigation, replacing legacy jQuery/vanilla JS logic.
    *   **Cleanup:** Removed all unused legacy JavaScript files from `app/public/static/js` (e.g., `landing.js`, `settings.js`, `profiles.js`, `streaming-settings.js`, `streaming-ui.js`, etc.).
    *   **Testing:** Verified user flows and fixed UI/UX issues (spacing, theme background).

### Phase 6: Mobile Integration (Pending)
*   **Goal:** Build for Android/iOS.
*   **Action:**
    *   Configure Tauri Mobile to point to the hosted API URL (since Sidecar is not supported on mobile).
    *   Or, implement offline logic using Tauri Plugins (`sql`, `fs`).

## 🔄 Hybrid Strategy (Keeping the Website)

To keep the website functioning during migration:
1.  **Development:** Use `npm run dev` (Vite) for SPA development. Use `npm run dev:server` (Bun) for API development.
2.  **Production:**
    *   Build the SPA (`npm run build`).
    *   Configure the Hono server (`src/index.ts`) to serve the static files from `dist/` for all non-API routes.
    *   This effectively turns the Hono server into an API + Static File Server.

## 🛠️ Troubleshooting

*   **"Loading..." stuck:** Check console for JS errors. Ensure the API server is running (Sidecar on Desktop).
*   **CORS Errors:** Ensure `vite.config.ts` proxy is configured correctly or the backend handles CORS.
*   **Hydration Errors:** Not applicable for pure CSR, but ensure HTML structure is valid.