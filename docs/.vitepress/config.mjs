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
      {
        text: 'Docs',
        items: [
          { text: 'Getting started', link: '/getting-started' },
          { text: 'Self hosting with Docker', link: '/self-hosting-docker' },
          { text: 'Usage', link: '/usage' },
          { text: 'Development', link: '/development' },
          { text: 'FAQ', link: '/faq' },
          { text: 'Environment variables', link: '/environment' }
        ]
      },
      { text: 'Releases', link: '/releases' },
      { text: 'Try Zentrio', link: 'https://zentrio.eu' }
    ],
 
    sidebar: [
      {
        text: 'Documentation',
        items: [
          { text: 'Getting started', link: '/getting-started' },
          { text: 'Self hosting with Docker', link: '/self-hosting-docker' },
          { text: 'Usage', link: '/usage' },
          { text: 'Development', link: '/development' },
          { text: 'FAQ', link: '/faq' },
          { text: 'Environment variables', link: '/environment' }
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