import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import packageJson from './package.json'

// Check if building for Tauri (native app)
const isTauriBuild =
  process.env.TAURI === 'true' ||
  process.argv.includes('--tauri') ||
  typeof process.env.TAURI_ENV_PLATFORM === 'string' ||
  typeof process.env.TAURI_ENV_TARGET_TRIPLE === 'string'
const isTauriDebugBuild = isTauriBuild && process.env.TAURI_ENV_DEBUG === 'true'
const shouldUseManualVendorChunks = !isTauriBuild

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
    __TAURI_BUILD__: JSON.stringify(isTauriBuild),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    exclude: [
      // FFmpeg WASM needs to be excluded for proper loading
      '@ffmpeg/ffmpeg',
      '@ffmpeg/util',
    ],
  },
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    sourcemap: isTauriDebugBuild,
    minify: isTauriDebugBuild ? false : undefined,
    // Increase chunk size limit to reduce warnings (but we'll optimize)
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (!shouldUseManualVendorChunks) {
            return undefined
          }

          // Split React ecosystem
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'react-vendor'
          }

          // Split React Router
          if (id.includes('node_modules/react-router')) {
            return 'router-vendor'
          }

          // Split Recharts and D3 (used only in admin DashboardPage - ~360 kB)
          if (id.includes('node_modules/recharts') || id.includes('node_modules/d3-') || id.includes('node_modules/victory-')) {
            return 'charts-vendor'
          }

          // Split Vidstack and media libraries (HLS.js, dash.js share this chunk)
          if (
            id.includes('node_modules/@vidstack') ||
            id.includes('node_modules/media-icons') ||
            id.includes('node_modules/hls.js') ||
            id.includes('node_modules/dashjs')
          ) {
            return 'media-vendor'
          }

          // Split FFmpeg WASM and libav.js - these are huge
          // EXCLUDE from Tauri builds - not needed for native playback
          if (!isTauriBuild && (id.includes('node_modules/@ffmpeg') || id.includes('node_modules/@libav'))) {
            return 'ffmpeg-vendor'
          }

          // Split TanStack Query
          if (id.includes('node_modules/@tanstack/react-query')) {
            return 'query-vendor'
          }

          // Split UI libraries
          if (id.includes('node_modules/lucide') || id.includes('node_modules/framer-motion')) {
            return 'ui-vendor'
          }

          // Split state management
          if (id.includes('node_modules/zustand') || id.includes('node_modules/immer')) {
            return 'state-vendor'
          }

          // Split notification / small utilities
          if (
            id.includes('node_modules/sonner') ||
            id.includes('node_modules/zod') ||
            id.includes('node_modules/lz-string') ||
            id.includes('node_modules/clsx') ||
            id.includes('node_modules/tailwind-merge')
          ) {
            return 'utils-vendor'
          }

          // Auth libraries
          if (id.includes('node_modules/better-auth') || id.includes('node_modules/bcryptjs')) {
            return 'auth-vendor'
          }
        },
      },
    },
  },
  // Exclude FFmpeg WASM files from being copied to dist in Tauri builds
  publicDir: isTauriBuild ? false : 'public',
  server: {
    host: true, // Listen on all network interfaces for Tauri Android
    port: 5173,
    strictPort: true,
    headers: {
      // same-origin enables SharedArrayBuffer for hybrid audio playback
      // credentialless allows cross-origin images while still enabling SharedArrayBuffer
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless',
      // Allow cross-origin requests to load resources from this server
      'Cross-Origin-Resource-Policy': 'cross-origin',
    },
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: false,
      },
    },
  },
})
