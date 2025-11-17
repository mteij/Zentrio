


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
        <link rel="manifest" href="/static/site.webmanifest" />
        <link rel="icon" href="/static/logo/favicon/favicon.ico" />
        <meta name="theme-color" content="#141414" />
        <script src="/static/js/mobile-session-handler.js"></script>
      </head>
      <body className={className}>
        {showHeader && <PageHeader />}
        <main>
          {children}
        </main>
        {showFooter && <PageFooter />}
        <script src="/static/js/toast.js"></script>
        <script dangerouslySetInnerHTML={{__html: `(function(){try{function u(){var o=navigator.onLine;document.querySelectorAll('[data-online-required]').forEach(function(el){if(o){el.removeAttribute('disabled');el.classList.remove('is-offline');}else{el.setAttribute('disabled','true');el.classList.add('is-offline');}});}window.addEventListener('online',function(){if(window.addToast)window.addToast('success','Online','Back online.');u();});window.addEventListener('offline',function(){if(window.addToast)window.addToast('info','Offline','Some features are disabled.');u();});u();if('serviceWorker'in navigator){navigator.serviceWorker.register('/static/sw.js',{scope:'/'}).catch(function(){});navigator.serviceWorker.addEventListener('message',function(e){var d=e.data;if(!d||typeof d!=='object')return;if(d.type==='zentrio-sw-toast'&&window.addToast){var p=d.payload||{};window.addToast(p.toastType||'info',p.title||'Notice',p.message||'');}});} }catch(e){}})();`}} />
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
        <link rel="manifest" href="/static/site.webmanifest" />
        <link rel="icon" href="/static/logo/favicon/favicon.ico" />
        <meta name="theme-color" content="#141414" />
        <script src="/static/js/mobile-session-handler.js"></script>
      </head>
      <body className={className}>
        {children}
        <script src="/static/js/toast.js"></script>
        <script dangerouslySetInnerHTML={{__html: `(function(){try{function u(){var o=navigator.onLine;document.querySelectorAll('[data-online-required]').forEach(function(el){if(o){el.removeAttribute('disabled');el.classList.remove('is-offline');}else{el.setAttribute('disabled','true');el.classList.add('is-offline');}});}window.addEventListener('online',function(){if(window.addToast)window.addToast('success','Online','Back online.');u();});window.addEventListener('offline',function(){if(window.addToast)window.addToast('info','Offline','Some features are disabled.');u();});u();if('serviceWorker'in navigator){navigator.serviceWorker.register('/static/sw.js',{scope:'/'}).catch(function(){});navigator.serviceWorker.addEventListener('message',function(e){var d=e.data;if(!d||typeof d!=='object')return;if(d.type==='zentrio-sw-toast'&&window.addToast){var p=d.payload||{};window.addToast(p.toastType||'info',p.title||'Notice',p.message||'');}});} }catch(e){}})();`}} />
      </body>
    </html>
  )
}
