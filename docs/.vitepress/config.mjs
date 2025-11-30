import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Zentrio Documentation',
  description: 'Profile management for Stremio Web',
  lang: 'en-US',
  base: '/',
  
  themeConfig: {
    logo: '/icon-512.png',
    nav: [
      { text: 'Getting Started', link: '/getting-started' },
      { text: 'Launch Zentrio', link: 'https://app.zentrio.eu' }
    ],
 
    sidebar: [
      {
        text: 'Introduction',
        items: [
          { text: 'Getting Started', link: '/getting-started' },
          { text: 'Usage Guide', link: '/usage' },
          { text: 'FAQ', link: '/faq' }
        ]
      },
      {
        text: 'Deployment',
        items: [
          { text: 'Self Hosting (Docker)', link: '/self-hosting-docker' },
          { text: 'Environment Variables', link: '/environment' },
          { text: 'SSO & OIDC', link: '/sso-oidc' }
        ]
      },
      {
        text: 'Customization',
        items: [
          { text: 'Styling Guide', link: '/styling-guide' }
        ]
      },
      {
        text: 'Development',
        items: [
          { text: 'Development Guide', link: '/development' },
          { text: 'Sync Architecture', link: '/sync-architecture' },
          { text: 'Sync Implementation', link: '/sync-implementation-plan' }
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