#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔨 Building Zentrio for Capacitor...');

// Clean dist directory
if (fs.existsSync('dist')) {
  fs.rmSync('dist', { recursive: true, force: true });
  console.log('✅ Cleaned dist directory');
}

// Create dist directory
fs.mkdirSync('dist', { recursive: true });

// Copy static assets
console.log('📁 Copying static assets...');
execSync('cpx "src/static/**/*" "dist/static"', { stdio: 'inherit' });

  // Build the server
 console.log('🔧 Building server...');
 execSync('bun build src/index.ts --outdir ./dist --target bun --minify', { stdio: 'inherit' });
 
 // Optionally build embedded Stremio Web frontend
 try {
   const appRoot = path.join(__dirname, '..');
   
   // Setup fresh stremio-web and apply patches
   console.log('🔄 Setting up fresh Stremio Web...');
   try {
     execSync('node scripts/setup-stremio-web.js', { cwd: appRoot, stdio: 'inherit' });
   } catch (setupErr) {
     console.error('⚠️ Failed to setup Stremio Web. Continuing without it.', setupErr);
     throw setupErr;
   }
   
   const stremioWebDir = path.join(__dirname, '..', 'vendor', 'stremio-web');
   
   if (fs.existsSync(stremioWebDir)) {
     console.log('📦 Building embedded Stremio Web...');
     
     execSync('npm run build', { cwd: stremioWebDir, stdio: 'inherit' });

     // Stremio Web outputs to "build" (see webpack.config.js -> output.path)
     const srcDir = path.join(stremioWebDir, 'build');
     const outDir = path.join(__dirname, '..', 'data', 'stremio-web-build');

     if (fs.existsSync(outDir)) {
       fs.rmSync(outDir, { recursive: true, force: true });
     }
     fs.mkdirSync(outDir, { recursive: true });

     // Copy built Stremio Web assets into data/stremio-web-build for the server to serve
     try {
       fs.cpSync(srcDir, outDir, { recursive: true });
       console.log('✅ Stremio Web build copied to data/stremio-web-build');
     } catch (copyErr) {
       console.error('⚠️ Failed to copy Stremio Web build into data/stremio-web-build', copyErr);
       throw copyErr;
     }
   } else {
     console.log('ℹ️ Skipping Stremio Web build: vendor/stremio-web not found after setup');
   }
 } catch (err) {
   console.error('⚠️ Failed to build embedded Stremio Web. Continuing without it.', err);
 }
 
 // Create a simple index.html for Capacitor
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
    <script src="/static/js/mobile-session-handler.js"></script>
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
        // Redirect to the server
        window.location.href = '/';
    </script>
</body>
</html>`;

fs.writeFileSync('dist/index.html', indexHtml);
console.log('✅ Created index.html');

console.log('🎉 Build completed successfully!');