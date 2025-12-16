import { jsxRenderer } from 'hono/jsx-renderer'

export const renderer = jsxRenderer(({ children }) => {
  return (
    <html>
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Zentrio</title>
        <link rel="stylesheet" href="/static/css/toast.css" />
        <script src="/static/js/toast.js"></script>
      </head>
      <body>{children as any}</body>
    </html> as any
  )
})