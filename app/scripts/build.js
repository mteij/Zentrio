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
const staticSrc = path.join(__dirname, '..', 'public', 'static');
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
 
 
 // Build the SPA
 console.log('🔧 Building SPA...');
 execSync('bun run vite build', { stdio: 'inherit' });
 console.log('✅ SPA built');

console.log('🎉 Build completed successfully!');