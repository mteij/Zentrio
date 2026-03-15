import { defineConfig } from 'vitepress'
import { withMermaid } from 'vitepress-plugin-mermaid'

export default withMermaid(defineConfig({
  title: 'Zentrio Docs',
  description: 'Guides for using, self-hosting, and developing Zentrio.',
  lang: 'en-US',
  base: '/',

  themeConfig: {
    logo: '/icon-512.png',
    nav: [
      { text: 'Overview', link: '/' },
      { text: 'Public Instance', link: 'https://app.zentrio.eu' },
      { text: 'API Docs', link: 'https://app.zentrio.eu/api/docs' },
      { text: 'GitHub', link: 'https://github.com/Mteij/Zentrio' }
    ],

    sidebar: [
      {
        text: 'Docs',
        items: [
          { text: 'Overview', link: '/' },
          { text: 'Using Zentrio', link: '/usage' },
          {
            text: 'Self Hosting',
            link: '/self-hosting',
            collapsed: false,
            items: [
              { text: 'Google SSO', link: '/self-hosting/sso/google' },
              { text: 'Discord SSO', link: '/self-hosting/sso/discord' },
              { text: 'GitHub SSO', link: '/self-hosting/sso/github' },
              { text: 'OpenID Connect', link: '/self-hosting/sso/openid' }
            ]
          },
          { text: 'Development', link: '/development' },
          { text: 'Contributing', link: '/contributing' }
        ]
      }
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/Mteij/Zentrio' }
    ],

    footer: {
      message: 'Self-hosted streaming across web and native clients.',
      copyright: `Copyright © ${new Date().getFullYear()} Zentrio`
    },

    search: {
      provider: 'local'
    },

    appearance: 'dark'
  },

  ignoreDeadLinks: true
}))
