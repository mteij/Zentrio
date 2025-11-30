# Zentrio Landing Page

This is the landing page for Zentrio, hosted at [zentrio.eu](https://zentrio.eu).

## Development

### Prerequisites

- Node.js 20 or higher
- npm or yarn

### Setup

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Deployment

The landing page is automatically deployed to GitHub Pages when changes are pushed to the main branch. The deployment is handled by the `.github/workflows/landing-page.yml` workflow.

### Domain Configuration

- The landing page is configured to deploy to `zentrio.eu`
- CNAME file is located at `public/CNAME`
- GitHub Pages settings should be configured to use the `zentrio.eu` domain

## Structure

- `src/App.vue` - Main Vue component
- `src/main.js` - Application entry point
- `index.html` - HTML template
- `public/` - Static assets (favicon, icons, CNAME)
- `vite.config.ts` - Vite configuration

## Related

- Documentation: [docs.zentrio.eu](https://docs.zentrio.eu)
- Repository: [github.com/mteij/Zentrio](https://github.com/mteij/Zentrio)