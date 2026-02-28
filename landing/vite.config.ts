import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [
    vue()
  ],
  base: '/',
  // Esbuild configuration (used for both dev and build)
  esbuild: {
    drop: ['console', 'debugger'],
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    // Optimize chunking for better caching and parallel loading
    rollupOptions: {
      output: {
        // Separate vendor chunks for better caching
        manualChunks: {
          // Core Vue chunk
          'vue-vendor': ['vue', 'vue-router'],
          // Animation chunk - lazy loaded features
          'motion': ['@vueuse/motion'],
        },
        // Add content hash to asset filenames for better caching
        assetFileNames: (assetInfo) => {
          const name = assetInfo.name || ''
          if (/\.(png|jpe?g|gif|svg|webp|ico)$/i.test(name)) {
            return 'assets/images/[name]-[hash][extname]'
          }
          if (/\.css$/i.test(name)) {
            return 'assets/css/[name]-[hash][extname]'
          }
          return 'assets/[name]-[hash][extname]'
        },
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
      },
    },
    // Target modern browsers for smaller bundles
    target: 'es2020',
    // Enable CSS code splitting
    cssCodeSplit: true,
    // Source maps for production debugging (can be disabled for max performance)
    sourcemap: false,
  },
  // Optimize dependencies pre-bundling
  optimizeDeps: {
    include: ['vue', 'vue-router', '@vueuse/motion', 'lucide-vue-next'],
  },
})