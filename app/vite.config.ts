import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    exclude: [
      '@ffmpeg/ffmpeg', 
      '@ffmpeg/util',
      // libav.js needs to be excluded to properly load WASM files
      '@libav.js/variant-webcodecs',
      'libav.js'
    ],
  },
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
  build: {
    outDir: 'dist',
    emptyOutDir: false,
  },
})