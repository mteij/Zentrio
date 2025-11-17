'use strict';

// Zentrio bootstrap patch for vendored Stremio Web.
//
// This is a placeholder/skeleton patch. It does NOT yet modify the vendor
// source, but gives us a dedicated place to move session/bootstrap wiring
// out of runtime DOM injections and into the build pipeline.
//
// When we have the vendor tree available locally, we can:
//   - Locate the main entrypoint(s) of Stremio Web (e.g. src/index.tsx or similar).
//   - Inject our session/bootstrap integration there instead of injecting
//     big inline <script> blocks at runtime.

module.exports.applyPatch = async function applyPatch(ctx) {
  const { vendorRoot, fs, path, console } = ctx;

  console.log('[StremioPatcher] 001-zentrio-bootstrap.js: starting');

  // TODO: implement bootstrap integration here.
  //
  // Example shape (adjust targetFile to the real entrypoint in vendor/stremio-web):
  //
  // const targetFile = path.join(vendorRoot, 'src', 'index.tsx');
  // if (!fs.existsSync(targetFile)) {
  //   console.warn('[StremioPatcher] 001-zentrio-bootstrap.js: target not found, skipping');
  //   return;
  // }
  //
  // let source = fs.readFileSync(targetFile, 'utf8');
  //
  // // Apply string replacements / AST transforms that:
  // //   - Read our injected session from window.zentrioSession / window.session.
  // //   - Wire bridge entrypoints for Addon Manager, Downloads Manager, NSFW filter.
  // //
  // // Example (placeholder):
  // // source = source.replace('/* ZENTRIO_SESSION_HOOK */', `
  // //   // Zentrio session bootstrap hook (patched in at build-time)
  // //   const zentrioSession = (window && (window.session || window.zentrioSession)) || null;
  // // `);
  //
  // fs.writeFileSync(targetFile, source, 'utf8');
  //
  // console.log('[StremioPatcher] 001-zentrio-bootstrap.js: patched', targetFile);

  console.log('[StremioPatcher] 001-zentrio-bootstrap.js: finished (no-op placeholder)');
};