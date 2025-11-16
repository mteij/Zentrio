# Zentrio Documentation

This directory contains the documentation for Zentrio, powered by GitHub Pages and Jekyll.

## How it works

This documentation site uses GitHub Pages with Jekyll, which requires minimal configuration:

- **Jekyll**: GitHub's built-in static site generator
- **Minimal theme**: Clean, simple design that works out of the box
- **Markdown**: Write documentation in familiar Markdown format
- **Auto-deployment**: Updates automatically when you push to GitHub

## File Structure

```
docs/
├── _config.yml          # Jekyll configuration
├── _layouts/
│   └── default.html     # Custom layout with navigation
├── index.md             # Homepage
├── ANDROID_SETUP.md     # Android setup guide
├── CAPACITOR.md         # Capacitor integration guide
├── QUICK_START_ANDROID.md # Quick start for Android
└── README.md            # This file
```

## Adding New Documentation

1. Create a new `.md` file in the `docs/` directory
2. Add it to the navigation in `_config.yml`:
   ```yaml
   navigation:
     - title: Your New Page
       url: your-new-page
   ```
3. Add front matter to your markdown file:
   ```markdown
   ---
   layout: default
   title: Your Page Title
   ---
   ```

## Deployment

The documentation is automatically deployed to GitHub Pages when you push to the main branch. To enable:

1. Go to your repository's Settings
2. Scroll down to "GitHub Pages"
3. Source: Deploy from a branch
4. Branch: `main` (or `master`) and `/docs` folder
5. Save

Your documentation will be available at:
`https://[username].github.io/[repository-name]`

## Customization

- Edit `_config.yml` to change site title, description, and navigation
- Edit `_layouts/default.html` to customize the layout and styling
- Add custom CSS in the `<style>` block of the layout file

## Benefits of This Approach

- **Zero dependencies**: No need to install anything locally
- **Free hosting**: GitHub Pages is free for public repositories
- **Version control**: Documentation is tracked with your code
- **Simple workflow**: Just edit markdown files and push
- **Fast**: Static sites load quickly
- **SEO friendly**: GitHub Pages handles the technical details