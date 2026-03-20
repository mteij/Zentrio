import { defineConfig } from 'vitepress'
import { withMermaid } from 'vitepress-plugin-mermaid'

export default withMermaid(defineConfig({
  title: 'Zentrio Docs',
  description: 'Clean documentation for self-hosting and operating Zentrio.',
  lang: 'en-US',
  base: '/',

  themeConfig: {
    logo: '/icon-512.png',
    nav: [
      { text: 'Self Hosting', link: '/self-hosting/' },
      { text: 'User Guide', link: '/guide/' },
      { text: 'Development', link: '/development/' },
      { text: 'Zentrio Web', link: 'https://zentrio.eu/web' },
      { text: 'GitHub', link: 'https://github.com/Mteij/Zentrio' }
    ],

    sidebar: [
      {
        text: 'Overview',
        items: [
          { text: 'Introduction', link: '/' }
        ]
      },
      {
        text: 'Self Hosting',
        items: [
          { text: 'Overview', link: '/self-hosting/' },
          { text: 'Installation', link: '/self-hosting/installation' },
          { text: 'Configuration', link: '/self-hosting/configuration' },
          { text: 'Operations', link: '/self-hosting/operations' },
          { text: 'Reverse Proxy', link: '/self-hosting/reverse-proxy' },
          {
            text: 'Authentication',
            collapsed: false,
            items: [
              { text: 'SSO Overview', link: '/self-hosting/sso/' },
              { text: 'Google SSO', link: '/self-hosting/sso/google' },
              { text: 'Discord SSO', link: '/self-hosting/sso/discord' },
              { text: 'GitHub SSO', link: '/self-hosting/sso/github' },
              { text: 'OpenID Connect', link: '/self-hosting/sso/openid' }
            ]
          }
        ]
      },
      {
        text: 'User Guide',
        items: [
          { text: 'Overview', link: '/guide/' },
          { text: 'Accounts and Profiles', link: '/guide/accounts-and-profiles' },
          { text: 'Addons and Playback', link: '/guide/addons-and-playback' },
          { text: 'Clients', link: '/guide/clients' }
        ]
      },
      {
        text: 'Development',
        items: [
          { text: 'Overview', link: '/development/' },
          { text: 'Local Setup', link: '/development/local-setup' },
          { text: 'Architecture', link: '/development/architecture' }
        ]
      },
      {
        text: 'Project',
        items: [
          { text: 'Contributing', link: '/contributing' }
        ]
      }
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/Mteij/Zentrio' }
    ],

    footer: {
      message: 'Self-hosted streaming across web and native clients.',
      copyright: `Copyright (c) ${new Date().getFullYear()} Zentrio`
    },

    search: {
      provider: 'local'
    },

    appearance: true
  },

  ignoreDeadLinks: true
}))
