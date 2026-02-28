import { defineConfig } from 'vitepress'
import { withMermaid } from 'vitepress-plugin-mermaid'

export default withMermaid(defineConfig({
  title: 'Zentrio Documentation',
  description: 'Profile management for Stremio Web',
  lang: 'en-US',
  base: '/',
  
  themeConfig: {
    logo: '/icon-512.png',
    nav: [
      { text: 'Launch Zentrio', link: 'https://app.zentrio.eu' },
      { text: 'API Docs', link: 'https://app.zentrio.eu/api/docs' }
    ],
 
    sidebar: [
      {
        text: 'Documentation',
        items: [
          { text: 'Usage', link: '/usage' },
          { 
            text: 'Self Hosting', 
            link: '/self-hosting',
            collapsed: false,
            items: [
              { text: 'Google', link: '/self-hosting/sso/google' },
              { text: 'Discord', link: '/self-hosting/sso/discord' },
              { text: 'GitHub', link: '/self-hosting/sso/github' },
              { text: 'OpenID Connect', link: '/self-hosting/sso/openid' }
            ]
          },
          { text: 'Development', link: '/development' },
          { text: 'Contributing', link: '/contributing' }
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
}))