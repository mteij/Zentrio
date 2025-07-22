import { AppProps } from "$fresh/server.ts";

export default function App({ Component }: AppProps) {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>StremioHub</title>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <style>
          {`
            body { font-family: 'Inter', sans-serif; background-color: #141414; }
            .profile-avatar { background-color: #333; border: 3px solid transparent; transition: border-color 0.3s ease; width: 150px; height: 150px; background-position: center; background-size: cover; }
            .profile-avatar:hover { border-color: #e50914; }
          `}
        </style>
      </head>
      <body class="text-white bg-gray-900 overflow-hidden h-screen">
        <div id="app" class="h-full flex flex-col">
          <Component />
        </div>
      </body>
    </html>
  );
}
