


interface LayoutProps {
  title: string
  children: any
  className?: string
  showHeader?: boolean
  showFooter?: boolean
  additionalCSS?: string[]
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
  additionalCSS = []
}: LayoutProps) {
  return (
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{title} - Zentrio</title>
        <script dangerouslySetInnerHTML={{__html: `(function(){try{var d=localStorage.getItem('zentrioThemeData');if(!d)return;var t=JSON.parse(d),doc=document.documentElement;var set=function(k,v){if(v)doc.style.setProperty(k,v)};set('--accent',t.accent);set('--btn-primary-bg',t.btnPrimary||t.accent);set('--btn-primary-bg-hover',t.btnPrimaryHover||t.btnPrimary||t.accent);set('--btn-secondary-bg',t.btnSecondary||t.accent);}catch(e){}})();`}} />
        <link rel="stylesheet" href="/static/css/styles.css" />
        <link rel="stylesheet" href="/static/css/toast.css" />
        {additionalCSS.map(css => <link rel="stylesheet" href={css} />)}
        <link rel="apple-touch-icon" sizes="180x180" href="/static/logo/favicon/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/static/logo/favicon/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/static/logo/favicon/favicon-16x16.png" />
        <link rel="manifest" href="/static/logo/favicon/site.webmanifest" />
        <link rel="icon" href="/static/logo/favicon/favicon.ico" />
        <meta name="theme-color" content="#141414" />
      </head>
      <body className={className}>
        {showHeader && <PageHeader />}
        <main>
          {children}
        </main>
        {showFooter && <PageFooter />}
        <script src="/static/js/toast.js"></script>
      </body>
    </html>
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

export function SimpleLayout({ title, children, className = '', additionalCSS = [] }: Omit<LayoutProps, 'showHeader' | 'showFooter'>) {
  return (
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{title} - Zentrio</title>
        <script dangerouslySetInnerHTML={{__html: `(function(){try{var d=localStorage.getItem('zentrioThemeData');if(!d)return;var t=JSON.parse(d),doc=document.documentElement;var set=function(k,v){if(v)doc.style.setProperty(k,v)};set('--accent',t.accent);set('--btn-primary-bg',t.btnPrimary||t.accent);set('--btn-primary-bg-hover',t.btnPrimaryHover||t.btnPrimary||t.accent);set('--btn-secondary-bg',t.btnSecondary||t.accent);}catch(e){}})();`}} />
        <link rel="stylesheet" href="/static/css/styles.css" />
        <link rel="stylesheet" href="/static/css/toast.css" />
        {additionalCSS.map(css => <link rel="stylesheet" href={css} />)}
        <link rel="apple-touch-icon" sizes="180x180" href="/static/logo/favicon/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/static/logo/favicon/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/static/logo/favicon/favicon-16x16.png" />
        <link rel="manifest" href="/static/logo/favicon/site.webmanifest" />
        <link rel="icon" href="/static/logo/favicon/favicon.ico" />
        <meta name="theme-color" content="#141414" />
      </head>
      <body className={className}>
        {children}
        <script src="/static/js/toast.js"></script>
      </body>
    </html>
  )
}
