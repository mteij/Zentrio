# CSS Modules Migration Guide

## What Are CSS Modules?

CSS Modules automatically scope CSS to individual components, eliminating global namespace conflicts. Each class name is transformed to be unique at build time.

## Quick Start

### 1. Create a CSS Module File

Name it `Component.module.css` (must end in `.module.css`):

```css
/* ProfilesPage.module.css */
.sectionTitle {
  font-size: 48px;
  color: white;
}

.profileCard {
  padding: 20px;
  border-radius: 16px;
}
```

### 2. Import and Use in Component

```tsx
import styles from "./ProfilesPage.module.css";

export function ProfilesPage() {
  return (
    <div>
      <h2 className={styles.sectionTitle}>Hello</h2>
      <div className={styles.profileCard}>Content</div>
    </div>
  );
}
```

### 3. Combining Classes

```tsx
// Single class
<div className={styles.profileCard} />

// Multiple classes
<div className={`${styles.profileCard} ${styles.active}`} />

// With global class
<div className={`${styles.profileCard} global-class-name`} />
```

## Naming Conventions

### CSS Module Classes (camelCase)

```css
.sectionTitle {
} /* NOT .section-title */
.profileCard {
} /* NOT .profile-card */
.footerButtons {
} /* NOT .footer-buttons */
```

### Why camelCase?

Easier to reference in JSX: `styles.sectionTitle` vs `styles['section-title']`

## Common Patterns

### Hover States

```css
.profileCard {
  background: white;
}

.profileCard:hover {
  background: gray;
}
```

### Nested Selectors

```css
.profileCard {
  padding: 20px;
}

.profileCard .profileName {
  font-size: 16px;
}

/* Or use parent selector */
.profileCard:hover .profileName {
  color: red;
}
```

### Media Queries

```css
.sectionTitle {
  font-size: 48px;
}

@media (max-width: 768px) {
  .sectionTitle {
    font-size: 36px;
  }
}
```

### Pseudo-elements

```css
.profileCard::before {
  content: "";
  position: absolute;
}
```

## Migration Checklist

For each component you want to migrate:

- [ ] 1. Create `ComponentName.module.css` file
- [ ] 2. Copy relevant CSS from global files
- [ ] 3. Convert class names to camelCase
- [ ] 4. Import module in component: `import styles from './Component.module.css'`
- [ ] 5. Replace `className="old-name"` with `className={styles.oldName}`
- [ ] 6. Test the component thoroughly
- [ ] 7. Remove old CSS from global files (or comment out)
- [ ] 8. Update `index.html` if removing entire CSS file

## What to Keep Global

Keep these in global `styles.css`:

- CSS reset/normalize
- CSS custom properties (`:root` variables)
- Global utility classes used everywhere
- Third-party library overrides

## Benefits You Get

✅ **Zero conflicts** - Styles can't leak between components
✅ **Better organization** - Styles live next to components
✅ **Easier refactoring** - Move component, styles move with it
✅ **Smaller bundles** - Unused styles get tree-shaken
✅ **No specificity wars** - Each class is uniquely scoped

## Example: Before & After

### Before (Global CSS)

```css
/* styles.css */
.section-title {
  font-size: 1.5rem; /* From settings page */
}

.section-title {
  font-size: 48px; /* From profiles page - conflicts! */
}
```

```tsx
<h2 className="section-title">Who's watching?</h2>
```

### After (CSS Module)

```css
/* ProfilesPage.module.css */
.sectionTitle {
  font-size: 48px; /* No conflicts! */
}
```

```tsx
import styles from "./ProfilesPage.module.css";
<h2 className={styles.sectionTitle}>Who's watching?</h2>;
```

## Troubleshooting

### Styles not applying?

- Check filename ends in `.module.css`
- Verify import path is correct
- Check class name spelling (camelCase)
- Look for typos in className usage

### Build errors?

- Ensure Vite is running (`bun run dev`)
- Check for syntax errors in CSS
- Verify all classnames exist in the module

### Mixing global and module styles?

```tsx
// This works!
<div className={`${styles.myClass} global-utility-class`}>
```

## Next Steps

After ProfilesPage success, consider migrating:

1. SettingsPage (has CSS conflicts)
2. Streaming pages
3. Shared components (Modal, dialogs)
4. Auth pages

Take it one component at a time!
