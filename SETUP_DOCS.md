# Setting Up Your Documentation Site

Your documentation site is now configured with minimal setup! Here's how to activate it:

## 🚀 Quick Setup (5 minutes)

### 1. Enable GitHub Pages

1. Go to your repository on GitHub
2. Click **Settings** tab
3. Scroll down to **GitHub Pages** section
4. Under "Source", select:
   - **Deploy from a branch**
   - **Branch**: `main` (or `master`)
   - **Folder**: `/docs`
5. Click **Save**

### 2. Enable GitHub Actions (if not already enabled)

1. Go to **Settings** → **Actions** → **General**
2. Scroll to "Workflow permissions"
3. Select **Read and write permissions**
4. Check "Allow GitHub Actions to create and approve pull requests"
5. Click **Save**

### 3. Push to trigger deployment

The documentation will automatically deploy when you push changes to the `docs/` folder:

```bash
git add docs/
git commit -m "Add documentation site"
git push origin main
```

## 📁 What Was Created

```
docs/
├── _config.yml          # Jekyll configuration
├── _layouts/
│   └── default.html     # Custom layout with navigation
├── index.md             # Homepage
├── ANDROID_SETUP.md     # Updated with Jekyll front matter
├── CAPACITOR.md         # Updated with Jekyll front matter
├── QUICK_START_ANDROID.md # Updated with Jekyll front matter
├── README.md            # Documentation guide
├── Gemfile              # Ruby dependencies for Jekyll
└── SETUP_DOCS.md        # This file

.github/workflows/
└── docs.yml             # Auto-deployment workflow
```

## 🎯 Features

- **Zero dependencies locally** - Everything runs on GitHub
- **Automatic deployment** - Push changes, they go live automatically
- **Clean navigation** - Simple menu between documentation pages
- **Responsive design** - Works on mobile and desktop
- **Fast loading** - Static site with minimal assets
- **Version controlled** - Documentation tracked with your code

## 📝 Adding New Documentation

1. Create a new `.md` file in the `docs/` folder
2. Add front matter at the top:
   ```markdown
   ---
   layout: default
   title: Your Page Title
   ---
   ```
3. Add it to the navigation in `_config.yml`:
   ```yaml
   navigation:
     - title: Your New Page
       url: your-new-page
   ```
4. Push to GitHub - it will automatically deploy!

## 🔗 Access Your Documentation

Once deployed, your documentation will be available at:
`https://[your-username].github.io/Zentrio`

## 🛠️ Customization

- **Edit `_config.yml`** to change site title, description, and navigation
- **Edit `_layouts/default.html`** to customize the layout and styling
- **Add custom CSS** in the `<style>` block of the layout file

## ✅ Benefits of This Approach

- **Free hosting** - GitHub Pages is free for public repos
- **No build tools needed** - Write markdown, push, done
- **Fast and secure** - Static sites are inherently secure
- **SEO friendly** - GitHub Pages handles the technical details
- **Integrated with GitHub** - No external services needed

That's it! You now have a professional documentation site with minimal configuration. 🎉