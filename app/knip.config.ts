import type { KnipConfig } from 'knip'

const config: KnipConfig = {
  entry: [
    // Scripts
    'scripts/**/*.{ts,js}',
    // Vitest picks these up automatically
    'src/**/*.{test,spec}.{ts,tsx}',
  ],

  project: ['src/**/*.{ts,tsx}'],

  ignore: [
    // Ambient type declarations
  ],

  ignoreDependencies: [
    // cpx used in build scripts via CLI, not imported
    'cpx',
    // baseline-browser-mapping referenced by Tailwind plugin
    'baseline-browser-mapping',
    // @types/* are type-only — knip can't detect type-only usage
    '@types/bcryptjs',
    '@types/hls.js',
    // @ffmpeg/core is loaded via CDN URL at runtime, not imported
    '@ffmpeg/core',
    // Tauri plugins: loaded via Tauri's plugin system, not static imports
    '@tauri-apps/plugin-notification',
    '@tauri-apps/plugin-shell',
    '@tauri-apps/plugin-store',
    // @hono/node-server: used in some deployment configurations
    '@hono/node-server',
    // tar: used in build scripts
    'tar',
    // prettier: invoked via CLI, not imported
    'prettier',
    // @iconify-json/material-symbols: consumed by Tailwind/Iconify at build time
    '@iconify-json/material-symbols',
  ],
}

export default config
