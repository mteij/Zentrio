#!/usr/bin/env node

// Zentrio - Stremio Web patch runner
//
// This script discovers and runs patch modules from "app/stremio-patches"
// against the vendored "app/vendor/stremio-web" project.
//
// Each patch module should export a function:
//   module.exports.applyPatch = async (ctx) => { ... }
// where ctx = { vendorRoot, patchesDir, fs, path, console }.

const fs = require('fs');
const path = require('path');

async function main() {
  const root = path.join(__dirname, '..');
  const vendorRoot = path.join(root, 'vendor', 'stremio-web');
  const patchesDir = path.join(root, 'stremio-patches');

  if (!fs.existsSync(vendorRoot)) {
    console.log('[StremioPatcher] vendor/stremio-web not found, skipping patching');
    return;
  }

  if (!fs.existsSync(patchesDir)) {
    console.log('[StremioPatcher] stremio-patches directory not found, no patches to apply');
    return;
  }

  const patchFiles = fs
    .readdirSync(patchesDir)
    .filter((file) => file.match(/^\d+.*\.js$/i))
    .sort();

  if (patchFiles.length === 0) {
    console.log('[StremioPatcher] No patch files found, nothing to do');
    return;
  }

  console.log('[StremioPatcher] Applying patches to vendor/stremio-web...');

  const ctx = { vendorRoot, patchesDir, fs, path, console };

  for (const file of patchFiles) {
    const fullPath = path.join(patchesDir, file);
    console.log(`[StremioPatcher] -> ${file}`);

    // eslint-disable-next-line global-require, import/no-dynamic-require
    const mod = require(fullPath);
    if (!mod || typeof mod.applyPatch !== 'function') {
      console.warn(`[StremioPatcher]   Skipping ${file} (no applyPatch export)`);
      continue;
    }

    // Allow patches to be async or sync
    await Promise.resolve(mod.applyPatch(ctx));
  }

  console.log('[StremioPatcher] All patches applied');
}

main().catch((err) => {
  console.error('[StremioPatcher] Failed to apply patches', err);
  process.exitCode = 1;
});