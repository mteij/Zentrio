import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Zentrio Documentation',
  description: 'Profile management for Stremio Web',
  lang: 'en-US',
  base: '/',
  
  themeConfig: {
    logo: '/icon-512.png',
    nav: [
      { text: 'Launch Zentrio', link: 'https://app.zentrio.eu' }
    ],
 
    sidebar: [
      {
        text: 'Documentation',
        items: [
          { text: 'Usage', link: '/usage' },
          { text: 'Trakt Integration', link: '/trakt' },
          { text: 'Self Hosting', link: '/self-hosting' },
          { text: 'Development', link: '/development' },
          { text: 'Contributing', link: '/contributing' },
          { text: 'Story', link: '/story' }
        ]
      }
    ],
 
    socialLinks: [
      { icon: 'github', link: 'https://github.com/mteij/Zentrio' }
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