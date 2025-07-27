import { PageProps } from "$fresh/server.ts";
import Footer from "../shared/components/Footer.tsx";

export default function App({ Component, route }: PageProps) {
  const showFooter =
    route.startsWith("/auth") ||
    route === "/";

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Zentrio</title>
        <link rel="stylesheet" href="/css/styles.css" />
        <link rel="stylesheet" href="/css/background.css" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#dc2626" id="theme-color-meta" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icons/icon-192.png" />
        <link rel="icon" type="image/png" sizes="512x512" href="/icons/icon-512.png" />
        <link rel="shortcut icon" type="image/png" href="/icons/icon-192.png" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/service-worker.js');
                });
              }
              document.addEventListener('DOMContentLoaded', function() {
                const savedAccentColor = localStorage.getItem('accentColor') || '#dc2626';
                const themeColorMeta = document.getElementById('theme-color-meta');
                if (themeColorMeta) {
                  themeColorMeta.content = savedAccentColor;
                }
                document.documentElement.style.setProperty('--accent-color', savedAccentColor);
              });
            `,
          }}
        />
      </head>
      <body class="text-white bg-black flex flex-col min-h-screen overflow-y-hidden">
        <div id="app" class="flex flex-col min-h-[calc(100vh-4rem)]">
          <main class="flex-1 flex flex-col animate-fadein">
            <Component />
          </main>
          {showFooter && <Footer />}
        </div>
        <style>
          {`
            @keyframes fadein {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            .animate-fadein {
              animation: fadein 0.5s cubic-bezier(.4,2,.6,1);
            }
          `}
        </style>
      </body>
    </html>
  );
}
