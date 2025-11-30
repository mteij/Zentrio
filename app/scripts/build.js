#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔨 Building Zentrio...');

// Clean dist directory
if (fs.existsSync('dist')) {
  fs.rmSync('dist', { recursive: true, force: true });
  console.log('✅ Cleaned dist directory');
}

// Create dist directory
fs.mkdirSync('dist', { recursive: true });

// Copy static assets
console.log('📁 Copying static assets...');
const staticSrc = path.join(__dirname, '..', 'src', 'static');
const staticDest = path.join(__dirname, '..', 'dist', 'static');

if (fs.existsSync(staticDest)) {
  fs.rmSync(staticDest, { recursive: true, force: true });
}
fs.mkdirSync(staticDest, { recursive: true });

try {
  fs.cpSync(staticSrc, staticDest, { recursive: true });
  console.log('✅ Static assets copied');
} catch (err) {
  console.error('❌ Failed to copy static assets:', err);
  process.exit(1);
}

  // Build the server
 console.log('🔧 Building server...');
 execSync('bun build src/index.ts --outdir ./dist --target bun --minify', { stdio: 'inherit' });

 // Compile server as sidecar
 console.log('🔧 Compiling server sidecar...');
 try {
   // Get host triple
   const rustInfo = execSync('rustc -vV').toString();
   const hostTriple = rustInfo.split('\n').find(line => line.startsWith('host: ')).split(': ')[1].trim();
   console.log(`Target triple: ${hostTriple}`);

   const binDir = path.join(__dirname, '..', 'src-tauri', 'bin');
   if (!fs.existsSync(binDir)) {
     fs.mkdirSync(binDir, { recursive: true });
   }

   const extension = process.platform === 'win32' ? '.exe' : '';
   const sidecarName = `zentrio-server-${hostTriple}${extension}`;
   const sidecarPath = path.join(binDir, sidecarName);

   execSync(`bun build --compile src/index.ts --outfile "${sidecarPath}"`, { stdio: 'inherit' });
   console.log(`✅ Compiled sidecar: ${sidecarName}`);
 } catch (err) {
   console.warn('⚠️ Failed to compile sidecar (this is expected if rustc is not available or on non-desktop builds):', err.message);
 }
 
 
 // Create a simple index.html
const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Zentrio</title>
    <link rel="manifest" href="/static/site.webmanifest">
    <link rel="icon" href="/static/logo/favicon/favicon.ico">
    <meta name="theme-color" content="#141414">
    <meta name="description" content="Zentrio - Profile Management for Stremio">
</head>
<body>
    <div id="app">
        <div style="display: flex; justify-content: center; align-items: center; height: 100vh; background: #141414; color: white; font-family: system-ui, -apple-system, sans-serif;">
            <div style="text-align: center;">
                <div style="font-size: 2rem; margin-bottom: 1rem;">⚡ Zentrio</div>
                <div style="opacity: 0.7;">Loading...</div>
            </div>
        </div>
    </div>
    <script>
        // Wait for Tauri to be ready and get the server port
        if (window.__TAURI__) {
            const invoke = window.__TAURI__.core.invoke;
            invoke('get_server_port')
                .then(port => {
                    window.location.href = 'http://localhost:' + port;
                })
                .catch(err => {
                    console.error('Failed to get server port:', err);
                    document.querySelector('#app').innerHTML = '<div style="color:red;padding:20px">Failed to start server: ' + err + '</div>';
                });
        } else {
            // Fallback for web/dev
            window.location.href = '/';
        }
    </script>
</body>
</html>`;

fs.writeFileSync('dist/index.html', indexHtml);
console.log('✅ Created index.html');

console.log('🎉 Build completed successfully!');