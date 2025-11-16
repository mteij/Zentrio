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
      { text: 'Home', link: '/' },
      { text: 'Try Zentrio.eu', link: 'https://zentrio.eu' },
      {
        text: 'Documentation',
        items: [
          { text: 'Getting Started', link: '/getting-started/' },
          { text: 'User Guide', link: '/user-guide/' },
          { text: 'Deployment', link: '/deployment/' },
          { text: 'API', link: '/api/' },
          { text: 'Reference', link: '/reference/' }
        ]
      }
    ],

    sidebar: [
      {
        text: 'Getting Started',
        items: [
          { text: 'Overview', link: '/getting-started/' },
          { text: 'Public Instance', link: '/getting-started/public-instance' },
          { text: 'Self-Hosting', link: '/getting-started/self-hosting' }
        ]
      },
      {
        text: 'User Guide',
        items: [
          { text: 'Overview', link: '/user-guide/' },
          { text: 'Profiles', link: '/user-guide/profiles' }
        ]
      },
      {
        text: 'Deployment',
        items: [
          { text: 'Overview', link: '/deployment/' }
        ]
      },
      {
        text: 'Mobile',
        items: [
          { text: 'Overview', link: '/mobile/' }
        ]
      },
      {
        text: 'Development',
        items: [
          { text: 'Overview', link: '/development/' }
        ]
      },
      {
        text: 'API',
        items: [
          { text: 'Overview', link: '/api/' },
          { text: 'Endpoints', link: '/api/endpoints' }
        ]
      },
      {
        text: 'Reference',
        items: [
          { text: 'Overview', link: '/reference/' },
          { text: 'Configuration', link: '/reference/configuration' },
          { text: 'Environment', link: '/reference/environment' },
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