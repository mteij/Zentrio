import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Zentrio',
  description: 'Profile management for Stremio Web',
  lang: 'en-US',
  
  head: [
    ['link', { rel: 'icon', href: '/favicon/favicon.ico' }],
    ['link', { rel: 'apple-touch-icon', sizes: '180x180', href: '/favicon/apple-touch-icon.png' }],
    ['link', { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon/favicon-32x32.png' }],
    ['link', { rel: 'icon', type: 'image/png', sizes: '16x16', href: '/favicon/favicon-16x16.png' }],
    ['meta', { name: 'theme-color', content: '#0366d6' }],
    ['meta', { name: 'og:type', content: 'website' }],
    ['meta', { name: 'og:locale', content: 'en' }],
    ['meta', { name: 'og:site_name', content: 'Zentrio' }],
    ['meta', { name: 'og:image', content: '/icon-512.png' }]
  ],

  themeConfig: {
    nav: [
      { text: '🏠 Home', link: '/' },
      { text: '🚀 Try Now', link: 'https://zentrio.eu' },
      {
        text: '📚 Docs',
        items: [
          { text: '🚀 Quick Start', link: '/getting-started/' },
          { text: '📖 User Guide', link: '/user-guide/' },
          { text: '🛠️ Self-Hosting', link: '/deployment/' },
          { text: '🔧 Development', link: '/development/' },
          { text: '❓ FAQ', link: '/help/faq' }
        ]
      }
    ],

    sidebar: [
      {
        text: '🚀 Quick Start',
        items: [
          { text: '⚡ Quick Start Guide', link: '/getting-started/quick-start' },
          { text: '🌐 Try Zentrio Now', link: '/getting-started/public-instance' },
          { text: '🏠 5-Minute Setup', link: '/getting-started/self-hosting' },
          { text: '📖 What is Zentrio?', link: '/getting-started/' }
        ]
      },
      {
        text: '📖 User Guide',
        items: [
          { text: 'Profile Management', link: '/user-guide/profiles' },
          { text: 'Settings & Customization', link: '/user-guide/settings' },
          { text: 'Themes', link: '/user-guide/themes' },
          { text: 'Mobile Apps', link: '/mobile/' }
        ]
      },
      {
        text: '🛠️ Self-Hosting',
        items: [
          { text: 'Installation Guide', link: '/deployment/' },
          { text: 'Docker Setup', link: '/deployment/docker' },
          { text: 'Configuration', link: '/reference/configuration' },
          { text: 'Environment Variables', link: '/reference/environment' }
        ]
      },
      {
        text: '🔧 Development',
        items: [
          { text: 'Contributing', link: '/development/' },
          { text: 'Setup Guide', link: '/development/setup' },
          { text: 'Architecture', link: '/development/architecture' },
          { text: 'API Reference', link: '/api/' }
        ]
      },
      {
        text: '❓ Help & Support',
        items: [
          { text: 'FAQ', link: '/help/faq' },
          { text: 'Troubleshooting', link: '/help/troubleshooting' },
          { text: 'Changelog', link: '/reference/changelog' }
        ]
      }
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/MichielEijpe/Zentrio' }
    ],

    footer: {
      message: 'Built for the Stremio community',
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
      tipLabel: 'Tip',
      warningLabel: 'Warning',
      dangerLabel: 'Danger',
      infoLabel: 'Info',
      detailsLabel: 'Details'
    }
  },

  vite: {
    define: {
      __VUE_OPTIONS_API__: false
    },
    ssr: {
      noExternal: ['prismjs']
    },
    build: {
      assetsInlineLimit: 4096,
      chunkSizeWarningLimit: 1000
    },
    server: {
      fs: {
        allow: ['..']
      }
    }
  },

  ignoreDeadLinks: true
})