/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Use CSS variables from design-system.css
        accent: 'var(--accent)',
        'accent-hover': 'var(--accent-hover)',
        'accent-muted': 'var(--accent-muted)',
        muted: 'var(--text-muted)',
        subtle: 'var(--text-subtle)',
        'bg-elevated': 'var(--bg-elevated)',
        'bg-card': 'var(--bg-card)',
        success: 'var(--success)',
        warning: 'var(--warning)',
        error: 'var(--error)',
        danger: 'var(--danger)',
      },
      backgroundColor: {
        glass: 'var(--glass-bg)',
        'glass-light': 'var(--glass-bg-light)',
      },
      borderColor: {
        DEFAULT: 'var(--border)',
        subtle: 'var(--border-subtle)',
        hover: 'var(--border-hover)',
        glass: 'var(--glass-border)',
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        xl: 'var(--shadow-xl)',
        accent: 'var(--shadow-accent)',
        card: 'var(--shadow-card)',
      },
      backdropBlur: {
        glass: 'var(--glass-blur)',
        'glass-sm': 'var(--glass-blur-sm)',
        'glass-lg': 'var(--glass-blur-lg)',
      },
      borderRadius: {
        xs: 'var(--radius-xs)',
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
      },
      transitionDuration: {
        fast: '150ms',
        normal: '200ms',
        slow: '300ms',
      },
      fontFamily: {
        sans: 'var(--font-sans)',
        mono: 'var(--font-mono)',
      },
      spacing: {
        nav: 'var(--nav-width-desktop)',
        'nav-mobile': 'var(--nav-height-mobile)',
      },
    },
  },
  plugins: [],
}