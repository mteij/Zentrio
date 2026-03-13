#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ─── Build Logger ─────────────────────────────────────────────────────
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
};

const buildStart = Date.now();
let stepStart = Date.now();

const log = {
  step: (msg) => {
    stepStart = Date.now();
    console.log(`\n${c.cyan}${c.bold}▶${c.reset} ${c.white}${msg}${c.reset}`);
  },
  success: (msg) => {
    const elapsed = Date.now() - stepStart;
    console.log(`${c.green}  ✔${c.reset} ${msg} ${c.dim}(${elapsed}ms)${c.reset}`);
  },
  info: (msg) => {
    console.log(`${c.dim}  ℹ ${msg}${c.reset}`);
  },
  warn: (msg) => {
    console.log(`${c.yellow}  ⚠ ${msg}${c.reset}`);
  },
  error: (msg, err) => {
    console.error(`${c.red}  ✖ ${msg}${c.reset}`);
    if (err) console.error(`${c.dim}    ${err}${c.reset}`);
  },
  banner: (msg) => {
    console.log(msg);
  },
  summary: () => {
    const total = ((Date.now() - buildStart) / 1000).toFixed(1);
    console.log(`\n${c.bold}${c.green}🎉 Build completed in ${total}s${c.reset}\n`);
  },
};

// ─── Banner ───────────────────────────────────────────────────────────
log.banner(
  `${c.bold}${c.cyan}\n  ╔══════════════════════════╗\n  ║   Building Zentrio...    ║\n  ╚══════════════════════════╝${c.reset}\n`
);

// ─── Clean ────────────────────────────────────────────────────────────
log.step('Cleaning dist directory');
if (fs.existsSync('dist')) {
  fs.rmSync('dist', { recursive: true, force: true });
  log.success('Cleaned dist directory');
} else {
  log.info('No dist directory to clean');
}
fs.mkdirSync('dist', { recursive: true });

// ─── Static Assets ────────────────────────────────────────────────────
log.step('Copying static assets');
const staticSrc = path.join(__dirname, '..', 'public', 'static');
const staticDest = path.join(__dirname, '..', 'dist', 'static');

if (fs.existsSync(staticDest)) {
  fs.rmSync(staticDest, { recursive: true, force: true });
}
fs.mkdirSync(staticDest, { recursive: true });

try {
  fs.cpSync(staticSrc, staticDest, { recursive: true });
  log.success('Static assets copied');
} catch (err) {
  log.error('Failed to copy static assets', err.message);
  process.exit(1);
}

// ─── Server Build ─────────────────────────────────────────────────────
log.step('Building server');
execSync('bun build src/index.ts --outdir ./dist --target bun --minify', { stdio: 'inherit' });
log.success('Server built');

// ─── Sidecar Compilation ──────────────────────────────────────────────
log.step('Compiling server sidecar');
try {
  const rustInfo = execSync('rustc -vV').toString();
  const hostTriple = rustInfo.split('\n').find(line => line.startsWith('host: ')).split(': ')[1].trim();
  log.info(`Target triple: ${hostTriple}`);

  const binDir = path.join(__dirname, '..', 'src-tauri', 'bin');
  if (!fs.existsSync(binDir)) {
    fs.mkdirSync(binDir, { recursive: true });
  }

  const extension = process.platform === 'win32' ? '.exe' : '';
  const sidecarName = `zentrio-server-${hostTriple}${extension}`;
  const sidecarPath = path.join(binDir, sidecarName);

  execSync(`bun build --compile src/index.ts --outfile "${sidecarPath}"`, { stdio: 'inherit' });
  log.success(`Compiled sidecar: ${sidecarName}`);
} catch (err) {
  log.warn('Failed to compile sidecar (expected if rustc is not available or on non-desktop builds)');
  log.info(err.message);
}

// ─── SPA Build ────────────────────────────────────────────────────────
log.step('Building SPA');
execSync('bun run vite build', { stdio: 'inherit' });
log.success('SPA built');

// ─── Summary ──────────────────────────────────────────────────────────
log.summary();