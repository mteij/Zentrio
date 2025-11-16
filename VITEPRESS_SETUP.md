# VitePress Documentation Setup

I've successfully converted your documentation to use **VitePress** - a modern, powerful documentation generator built on Vite. Here's what was created:

## 📁 New Documentation Structure

```
documentation/
├── package.json                    # VitePress dependencies
├── .vitepress/
│   └── config.ts                   # VitePress configuration
├── index.md                        # Landing page (hero layout)
├── self-hosting.md                 # Self-hosting guide
├── development.md                  # Development guide
├── configuration.md                # Configuration reference
├── mobile.md                       # Mobile apps guide
├── api.md                          # API reference
├── android-setup.md                # Android setup guide
├── capacitor.md                    # Capacitor integration
├── quick-start-android.md          # Quick Android setup
└── CNAME                           # Custom domain
```

## 🚀 VitePress Benefits

### Modern & Fast
- **Vite-powered** - Instant hot reload in development
- **Optimized builds** - Automatic code splitting and optimization
- **Vue 3 components** - Rich interactive documentation

### Professional Features
- **Beautiful themes** - Dark/light mode with smooth transitions
- **Search functionality** - Built-in full-text search
- **Mobile responsive** - Perfect on all devices
- **SEO optimized** - Meta tags and structured data

### Developer Experience
- **Markdown enhanced** - Syntax highlighting, code groups, alerts
- **Vue components** - Interactive demos and examples
- **TypeScript support** - Full type safety
- **Git integration** - Edit links and version info

## 🎨 Landing Page Features

The new landing page includes:
- **Hero section** with your logo and call-to-action buttons
- **Feature cards** showcasing Zentrio's capabilities
- **Quick start options** for public instance vs self-hosting
- **Tech stack badges** and professional styling
- **Responsive design** that works on all devices

## 📚 Enhanced Documentation

### Better Navigation
- **Sidebar navigation** with logical grouping
- **Emoji icons** for visual hierarchy
- **Search functionality** for finding content quickly
- **Breadcrumb navigation** for easy orientation

### Rich Content
- **Code blocks** with syntax highlighting
- **Alert boxes** (tips, warnings, dangers)
- **Tabs and collapsible sections**
- **Interactive examples** where appropriate

### Professional Styling
- **Dark/light theme toggle**
- **Consistent typography** and spacing
- **Hover states** and smooth transitions
- **Print-friendly** styles

## 🔧 Configuration

### VitePress Config
The [`.vitepress/config.ts`](documentation/.vitepress/config.ts) includes:
- **Custom navigation** with emojis and external links
- **Structured sidebar** with logical grouping
- **Social links** and footer configuration
- **SEO optimization** and meta tags
- **Search functionality** and edit links

### Custom Domain
- **CNAME file** configured for `docs.zentrio.eu`
- **Base path** set to `/Zentrio/` for GitHub Pages
- **Automatic HTTPS** with GitHub Pages

## 🚀 Deployment

### GitHub Actions
New workflow [`.github/workflows/vitepress-docs.yml`](.github/workflows/vitepress-docs.yml):
- **Automatic builds** on documentation changes
- **Node.js caching** for faster builds
- **GitHub Pages deployment** with proper permissions
- **Pull request previews** for documentation changes

### Local Development
```bash
# Navigate to documentation folder
cd documentation

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## 🌐 Next Steps

### 1. Update GitHub Pages Settings
1. Go to repository Settings → Pages
2. Source: **Deploy from a branch**
3. Branch: **main** → **/(root)**
4. Save settings

### 2. Configure Custom Domain
1. Add DNS record for `docs.zentrio.eu`:
   ```
   Type: CNAME
   Name: docs
   Value: michieleijpe.github.io
   ```

### 3. Test Documentation
1. Push changes to trigger build
2. Check GitHub Actions for successful deployment
3. Visit `https://docs.zentrio.eu` once DNS propagates

## 📝 Adding New Documentation

### Create New Page
1. Add `.md` file to `documentation/` folder
2. Add front matter if needed:
   ```markdown
   ---
   title: Page Title
   ---
   ```
3. Update sidebar in `.vitepress/config.ts`:
   ```typescript
   {
     text: 'Section Name',
     items: [
       { text: 'New Page', link: '/new-page' }
     ]
   }
   ```

### Rich Content Examples
```markdown
::: tip 💡 Tip
This is a helpful tip for users.
:::

::: warning ⚠️ Warning
Be careful with this configuration.
:::

::: danger 🚨 Danger
This can cause serious issues.
:::

<!-- Code groups -->
::: code-group

```bash [npm]
npm install vitepress
```

```bash [yarn]
yarn add vitepress
```

:::
```

## 🔄 Migration from Jekyll

The old Jekyll documentation in the `docs/` folder can be removed after verifying the VitePress version works correctly:

```bash
# Remove old Jekyll docs (after testing)
rm -rf docs/
```

## 🎉 Benefits Summary

✅ **Modern technology** - Vite + Vue 3 + TypeScript  
✅ **Better performance** - Faster builds and loading  
✅ **Enhanced UX** - Search, themes, responsive design  
✅ **Easier maintenance** - Component-based architecture  
✅ **Professional appearance** - Beautiful out-of-the-box  
✅ **SEO optimized** - Better search engine visibility  
✅ **Developer friendly** - Hot reload and rich content  

Your documentation now provides a world-class experience that effectively promotes Zentrio.eu while giving users comprehensive self-hosting and development guidance!