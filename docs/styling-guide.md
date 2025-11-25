# Zentrio Styling Guide

This guide defines the styling principles, color palette, and component guidelines for the Zentrio application, focusing on a modern, glassmorphic aesthetic, accessibility, and clean design.

## Core Principles

1.  **Glassmorphism**: Use translucent backgrounds with blur effects (`backdrop-filter: blur()`) to create depth and hierarchy.
2.  **Clean & Minimal**: Prioritize content visibility. Use whitespace effectively. Avoid clutter.
3.  **Accessibility**: Ensure high contrast for text, clear focus states for interactive elements, and semantic HTML.
4.  **Mobile-First**: Design for touch interactions and smaller screens first, then scale up to desktop.
5.  **Consistent Iconography**: Use **Iconify** with the **Lucide** collection (`lucide:*`) for all icons to ensure a unified look.

## Color Palette

| Variable | Value | Description |
| :--- | :--- | :--- |
| `--bg` | `#141414` | Main background color (dark gray/black) |
| `--text` | `#ffffff` | Primary text color |
| `--text-muted` | `#b3b3b3` | Secondary/muted text color |
| `--accent` | `#e50914` | Primary accent color (Zentrio Red) |
| `--glass-bg` | `rgba(20, 20, 20, 0.6)` | Standard glass background |
| `--glass-border` | `rgba(255, 255, 255, 0.1)` | Subtle border for glass elements |
| `--glass-blur` | `20px` | Standard blur amount |

## Typography

-   **Font Family**: 'Helvetica Neue', Arial, sans-serif
-   **Headings**: Bold, clear, and hierarchical.
-   **Body**: Readable size (min 16px for body text), good line height (1.5).

## Glassmorphism Implementation

Use the following CSS pattern for glass containers:

```css
.glass-panel {
    background: var(--glass-bg);
    backdrop-filter: blur(var(--glass-blur));
    -webkit-backdrop-filter: blur(var(--glass-blur));
    border: 1px solid var(--glass-border);
    box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
}
```

## Iconography (Iconify)

We use **Iconify** with the **Lucide** icon set.

-   **Usage**: `<span class="iconify" data-icon="lucide:icon-name"></span>` or `<i class="iconify" data-icon="lucide:icon-name"></i>`
-   **Size**: Standard size is `24px` (width/height).
-   **Color**: Inherit from parent text color (`currentColor`) or use specific utility classes.

**Example:**

```html
<span class="iconify" data-icon="lucide:play" data-width="24" data-height="24"></span>
```

## Components

### Buttons

-   **Primary**: Solid accent color, bold text.
-   **Secondary/Glass**: Translucent background, white text, border.
-   **Icon Buttons**: Circular or square, centered icon.

### Cards (Media)

-   **Hover Effect**: Scale up (`transform: scale(1.05)`), increase z-index, show overlay.
-   **Poster**: Rounded corners, aspect ratio preservation.

### Navigation

-   **Desktop**: Top bar with logo, links, and profile dropdown.
-   **Mobile**: Bottom tab bar or hamburger menu (depending on complexity).

## Accessibility Checklist

-   [ ] Text contrast ratio meets WCAG AA standards.
-   [ ] Interactive elements have a minimum touch target of 44x44px.
-   [ ] Focus rings are visible for keyboard navigation.
-   [ ] Images have `alt` attributes.
-   [ ] ARIA labels used for icon-only buttons.