import { useEffect } from 'react'

interface LayoutProps {
  title: string
  children: any
  className?: string
  showHeader?: boolean
  showFooter?: boolean
  additionalJS?: string[]
  disableThemeSync?: boolean
}

interface PageHeaderProps {
  title?: string
  children?: any
  className?: string
}

interface PageFooterProps {
  children?: any
  className?: string
}

export function Layout({
  title,
  children,
  className = '',
  showHeader = true,
  showFooter = true,
  additionalJS = [],
  disableThemeSync = false
}: LayoutProps) {
  useEffect(() => {
    document.title = `${title} - Zentrio`;
  }, [title]);

  useEffect(() => {
    if (!disableThemeSync) {
      try {
        const d = localStorage.getItem('zentrioActiveThemeConfig');
        if (d) {
          const t = JSON.parse(d);
          const doc = document.documentElement;
          const set = (k: string, v: string) => { if (v) doc.style.setProperty(k, v) };
          set('--accent', t.accent);
          set('--btn-primary-bg', t.btnPrimary || t.accent);
          set('--btn-primary-bg-hover', t.btnPrimaryHover || t.btnPrimary || t.accent);
          set('--btn-secondary-bg', t.btnSecondary || t.accent);
          set('--text', t.text || '#ffffff');
          set('--muted', t.muted || '#b3b3b3');
          
          if (t.background) {
            set('--bg', t.background.primary);
            set('--bg-elevated', t.background.secondary);
            set('--bg-card', t.background.tertiary);
          }
        }
      } catch (e) {}
    }
  }, [disableThemeSync]);

  const jsKey = additionalJS.join(',');
  useEffect(() => {
    // Handle additional JS
    const scripts: HTMLScriptElement[] = []
    additionalJS.forEach(js => {
        const script = document.createElement('script')
        script.src = js
        document.head.appendChild(script)
        scripts.push(script)
    })

    return () => {
        scripts.forEach(script => {
            if (script.parentNode) {
                script.parentNode.removeChild(script)
            }
        })
    }
  }, [jsKey]);


  return (
    <div className={`${className} ${showHeader === false && showFooter === false ? 'layout-player' : ''}`}>
      {showHeader && <PageHeader />}
      <main className={showHeader === false && showFooter === false ? 'main-player' : ''}>
        {children}
      </main>
      {showFooter && <PageFooter />}
    </div>
  )
}

export function PageHeader({ title, children, className = '' }: PageHeaderProps) {
  return (
    <header className={`header ${className}`}>
      <nav className="nav">
        {title && <div className="logo">{title}</div>}
        {children}
      </nav>
    </header>
  )
}

export function PageFooter({ children, className = '' }: PageFooterProps) {
  return (
    <footer className={`footer ${className}`}>
      {children}
    </footer>
  )
}

export function SimpleLayout({ title, children, className = '', disableThemeSync = false }: Omit<LayoutProps, 'showHeader' | 'showFooter'>) {
  useEffect(() => {
    document.title = `${title} - Zentrio`;
  }, [title]);

  useEffect(() => {
    if (!disableThemeSync) {
      try {
        const d = localStorage.getItem('zentrioActiveThemeConfig');
        if (d) {
          const t = JSON.parse(d);
          const doc = document.documentElement;
          const set = (k: string, v: string) => { if (v) doc.style.setProperty(k, v) };
          set('--accent', t.accent);
          set('--btn-primary-bg', t.btnPrimary || t.accent);
          set('--btn-primary-bg-hover', t.btnPrimaryHover || t.btnPrimary || t.accent);
          set('--btn-secondary-bg', t.btnSecondary || t.accent);
          set('--text', t.text || '#ffffff');
          set('--muted', t.muted || '#b3b3b3');

          if (t.background) {
            set('--bg', t.background.primary);
            set('--bg-elevated', t.background.secondary);
            set('--bg-card', t.background.tertiary);
          }
        }
      } catch (e) {}
    }
  }, [disableThemeSync]);

  return (
    <div className={className}>
      {children}
    </div>
  )
}
