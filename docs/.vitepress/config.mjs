import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Zentrio Documentation',
  description: 'Profile management for Stremio Web',
  lang: 'en-US',
  base: '/',
  
  themeConfig: {
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Getting Started', link: '/getting-started' },
      { text: 'Try Zentrio', link: 'https://zentrio.eu' }
    ],
 
    sidebar: [
      {
        text: 'Documentation',
        items: [
          { text: 'Getting started', link: '/getting-started' }
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
 
    appearance: 'dark'
  },

  ignoreDeadLinks: true
})