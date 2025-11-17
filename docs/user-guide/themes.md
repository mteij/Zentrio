# 🎨 Themes Guide

Personalize your Zentrio experience with our comprehensive theming system. Choose from built-in themes or create your own custom look.

## 🎯 Available Themes

### Built-in Themes

| Theme | Style | Primary Color | Best For |
|-------|-------|---------------|----------|
| **Zentrio** | Dark | Blue (#0366d6) | General use, modern look |
| **Midnight** | Dark | Purple (#6f42c1) | Night viewing, reduced eye strain |
| **Stremio** | Dark | Orange (#ff6b00) | Familiar Stremio experience |

### Theme Previews

#### 🌙 Zentrio (Default)
- Modern dark theme with blue accents
- High contrast for readability
- Optimized for extended viewing sessions

#### 🌌 Midnight
- Dark theme with purple accents
- Reduced blue light for night viewing
- Softer on the eyes

#### 🔥 Stremio
- Classic Stremio-inspired design
- Orange accent colors
- Familiar interface for Stremio users

## 🔄 Switching Themes

### Quick Theme Switch

1. Click the **Settings** gear icon
2. Navigate to **Appearance** → **Theme**
3. Select your preferred theme from the dropdown
4. Changes apply instantly

### Profile-Specific Themes

Each profile can have its own theme:
- Themes are saved per profile
- Switching profiles switches themes automatically
- Great for family members with different preferences

## 🎨 Theme Features

### Color Schemes

Each theme includes carefully selected colors for:
- **Primary**: Main accent color for buttons and highlights
- **Secondary**: Supporting colors and less prominent elements
- **Background**: Main background color
- **Surface**: Cards, modals, and elevated elements
- **Text**: Primary text color
- **Text Secondary**: Less prominent text

### Typography

Themes include optimized typography:
- **Font Family**: Inter, system-ui fallback
- **Font Sizes**: Responsive scaling for different screen sizes
- **Font Weights**: Balanced hierarchy for readability
- **Line Height**: Comfortable reading experience

### Responsive Design

All themes are fully responsive:
- **Desktop**: Optimized for large screens
- **Tablet**: Adaptive layouts for medium screens
- **Mobile**: Touch-friendly interface for small screens

## 🛠️ Custom Theme Creation

::: tip 👨‍💻 For Advanced Users
Creating custom themes requires basic CSS knowledge. See our [development guide](../development/themes.md) for detailed instructions.
:::

### Theme Structure

Custom themes follow this structure:

```json
{
  "name": "custom-theme",
  "displayName": "My Custom Theme",
  "colors": {
    "primary": "#0366d6",
    "secondary": "#586069",
    "background": "#ffffff",
    "surface": "#f6f8fa",
    "text": "#24292e",
    "textSecondary": "#586069"
  },
  "typography": {
    "fontFamily": "Inter, sans-serif",
    "fontSize": {
      "base": "16px",
      "lg": "18px",
      "xl": "20px"
    }
  }
}
```

### Creating Your Theme

1. **Choose Base Theme**: Start with an existing theme
2. **Modify Colors**: Adjust color values to your preference
3. **Test**: Apply and test your theme
4. **Refine**: Make adjustments based on testing
5. **Share**: Export and share your theme

### Color Selection Tips

- **Contrast**: Ensure text has sufficient contrast with backgrounds
- **Accessibility**: Follow WCAG guidelines for color contrast ratios
- **Consistency**: Use consistent color language throughout
- **Mood**: Choose colors that match your intended mood/usage

## 🎯 Theme Recommendations

### For Different Use Cases

#### 🎬 Movie Watching
- **Theme**: Midnight
- **Why**: Reduced eye strain for long viewing sessions
- **Features**: Dark interface, minimal blue light

#### 📺 Daily Browsing
- **Theme**: Zentrio (default)
- **Why**: Balanced contrast and modern appearance
- **Features**: Good readability, professional look

#### 👨‍👩‍👧‍👦 Family Use
- **Theme**: Zentrio
- **Why**: Modern and accessible for all ages
- **Features**: Good readability, professional look

#### 🌙 Late Night
- **Theme**: Midnight
- **Why**: Easy on the eyes in dark environments
- **Features**: Dark theme, reduced blue light

### For Different Environments

#### 💼 Office Environment
- **Theme**: Zentrio
- **Why**: Professional appearance, good visibility
- **Features**: Clean look, appropriate for work settings

#### 🏠 Home Theater
- **Theme**: Midnight
- **Why**: Minimal distraction, cinema-like experience
- **Features**: Dark interface, immersive feel

#### 📱 Mobile/Tablet
- **Theme**: Zentrio
- **Why**: Good touch targets, readable on small screens
- **Features**: Optimized for touch interfaces

## 🔧 Theme Settings

### Theme Persistence

- Themes are saved per profile
- Settings persist across browser sessions
- Sync across devices when using same instance

### Theme Overrides

Some settings can override theme colors:
- **High Contrast**: System accessibility settings
- **Dark Mode**: System dark mode preference
- **Custom CSS**: User-provided customizations

## 🌈 Advanced Customization

### CSS Custom Properties

For developers, themes use CSS custom properties:

```css
:root {
  --color-primary: #0366d6;
  --color-background: #ffffff;
  --color-text: #24292e;
  --font-family: Inter, sans-serif;
}
```

### Component-Specific Styling

Fine-tune specific components:

```css
/* Custom button styling */
.button {
  background: var(--color-primary);
  border-radius: 8px;
}

/* Custom card styling */
.card {
  background: var(--color-surface);
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}
```

## 🎨 Theme Gallery

### Community Themes

::: tip 🤝 Share Your Theme
Created an amazing theme? Share it with the community on [GitHub Discussions](https://github.com/MichielEijpe/Zentrio/discussions)!
:::

#### Featured Community Themes

*Community themes will be featured here as they're created and shared.*

### Theme Showcase

See how others use Zentrio themes:
- **Home Theater Setups**: Dark themes for cinema experience
- **Family Configurations**: Multiple themes for different family members
- **Accessibility**: High-contrast themes for visual accessibility

## 🔄 Theme Updates

### Automatic Updates

Built-in themes update automatically with Zentrio:
- New color refinements
- Improved accessibility
- Enhanced responsive design

### Custom Theme Migration

When updating Zentrio:
- Custom themes are preserved
- New theme properties may be available
- Test custom themes after updates

## 🆘 Theme Troubleshooting

### Theme Not Applying

1. **Refresh Page**: Hard refresh (Ctrl+F5 or Cmd+Shift+R)
2. **Clear Cache**: Clear browser cache and localStorage
3. **Check Console**: Look for CSS errors in developer tools
4. **Try Different Browser**: Rule out browser-specific issues

### Colors Look Wrong

1. **Check System Settings**: System dark mode may override
2. **Verify Contrast**: Ensure colors meet accessibility standards
3. **Test Different Content**: Some content may have fixed colors
4. **Reset Theme**: Switch to default and back

### Performance Issues

1. **Optimize Images**: Large theme images can slow loading
2. **Minimize CSS**: Remove unused custom CSS
3. **Check Animations**: Complex animations may impact performance
4. **Test Performance**: Use browser dev tools performance tab

---

Ready to create your own theme? Check our [development guide](../development/themes.md) for detailed instructions, or [share your creations](https://github.com/MichielEijpe/Zentrio/discussions) with the community!