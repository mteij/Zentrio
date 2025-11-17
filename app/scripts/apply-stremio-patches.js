#!/usr/bin/env node

// Zentrio - Stremio Web patch runner
//
// This script discovers and injects patch modules from "app/stremio-patches"
// into the vendored "app/vendor/stremio-web" project.
//
// Each patch file should be client-side JavaScript that will be injected
// into the Stremio Web build.

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

  const targetFile = path.join(vendorRoot, 'src', 'index.js');

  if (!fs.existsSync(targetFile)) {
    console.warn(`[StremioPatcher] Target file not found: ${targetFile}, skipping patching.`);
    return;
  }

  console.log('[StremioPatcher] Applying patches to vendor/stremio-web...');

  try {
    // Concatenate all patch files into a single string
    let allPatches = '\n\n// === ZENTRIO PATCHES START ===\n';
    for (const file of patchFiles) {
      const codeFilePath = path.join(patchesDir, file);
      const content = fs.readFileSync(codeFilePath, 'utf8');
      allPatches += `\n// Injected from: ${file}\n`;
      allPatches += content;
      allPatches += '\n';
    }
    allPatches += '// === ZENTRIO PATCHES END ===\n';

    // Append the combined patches to the end of the target file
    fs.appendFileSync(targetFile, allPatches, 'utf8');

    console.log(`[StremioPatcher] Successfully applied ${patchFiles.length} patches to ${path.relative(vendorRoot, targetFile)}`);

  } catch (error) {
    console.error(`[StremioPatcher] Error applying patches:`, error);
    return;
  }

  console.log('[StremioPatcher] All patches applied');
}

main().catch((err) => {
  console.error('[StremioPatcher] Failed to apply patches', err);
  process.exitCode = 1;
});