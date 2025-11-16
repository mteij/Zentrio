import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Zentrio',
  description: 'Profile management for Stremio Web',
  lang: 'en-US',
  base: '/Zentrio/',
  
  head: [
    ['link', { rel: 'icon', href: '/Zentrio/favicon/favicon.ico' }],
    ['link', { rel: 'apple-touch-icon', sizes: '180x180', href: '/Zentrio/favicon/apple-touch-icon.png' }],
    ['link', { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/Zentrio/favicon/favicon-32x32.png' }],
    ['link', { rel: 'icon', type: 'image/png', sizes: '16x16', href: '/Zentrio/favicon/favicon-16x16.png' }],
    ['meta', { name: 'theme-color', content: '#0366d6' }],
    ['meta', { name: 'og:type', content: 'website' }],
    ['meta', { name: 'og:locale', content: 'en' }],
    ['meta', { name: 'og:site_name', content: 'Zentrio' }],
    ['meta', { name: 'og:image', content: '/Zentrio/icon-512.png' }]
  ],

  themeConfig: {
    nav: [
      { text: '🏠 Home', link: '/' },
      { text: '🚀 Try Zentrio.eu', link: 'https://zentrio.eu' },
      { text: '🏠 Self-Host', link: '/self-hosting' },
      { text: '📱 Mobile', link: '/mobile' },
      { text: '⚙️ Config', link: '/configuration' },
      { text: '👨‍💻 Dev', link: '/development' }
    ],

    sidebar: [
      {
        text: 'Getting Started',
        items: [
          { text: '🏠 Introduction', link: '/' },
          { text: '🚀 Try Public Instance', link: 'https://zentrio.eu' },
          { text: '🏠 Self-Hosting', link: '/self-hosting' },
          { text: '⚙️ Configuration', link: '/configuration' }
        ]
      },
      {
        text: 'Development',
        items: [
          { text: '👨‍💻 Development Guide', link: '/development' },
          { text: '📚 API Reference', link: '/api' },
          { text: '📱 Mobile Apps', link: '/mobile' }
        ]
      },
      {
        text: 'Platform Setup',
        items: [
          { text: '📖 Android Setup', link: '/android-setup' },
          { text: '🔌 Capacitor Integration', link: '/capacitor' },
          { text: '🚀 Quick Start Android', link: '/quick-start-android' }
        ]
      }
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/MichielEijpe/Zentrio' }
    ],

    footer: {
      message: 'Built with ❤️ for the Stremio community',
      copyright: `Copyright © ${new Date().getFullYear()} Zentrio`
    },

    search: {
      provider: 'local'
    },

    editLink: {
      pattern: 'https://github.com/MichielEijpe/Zentrio/edit/main/docs/:path',
      text: 'Edit this page on GitHub'
    },

    appearance: 'dark'
  },

  markdown: {
    theme: {
      light: 'github-light',
      dark: 'github-dark'
    },
    lineNumbers: true,
    container: {
      tipLabel: '💡 Tip',
      warningLabel: '⚠️ Warning',
      dangerLabel: '🚨 Danger',
      infoLabel: 'ℹ️ Info',
      detailsLabel: 'Details'
    }
  },

  vite: {
    define: {
      __VUE_OPTIONS_API__: false
    }
  },

  ignoreDeadLinks: [
    // Ignore external links
    /^https?:\/\//,
    // Ignore links to directories (they're valid references)
    /\/$/,
    // Ignore specific patterns that might be false positives
    /^mailto:/,
    /^tel:/,
    // Ignore relative links to files outside docs directory
    /^\.\.\/\.\./,
    // Ignore root-relative links to files outside docs directory
    /^\/[^/]/,
    // Ignore specific file patterns that are referenced but not in docs
    /\.env\.example$/,
    /\/app\/src\//,
    /\/app\/android\//,
    /\/app\/ios\//
  ]
})