'use strict';

// Zentrio bootstrap patch for vendored Stremio Web.
//
// This patch injects the session bootstrap code directly into the main entrypoint
// instead of injecting it at runtime via DOM manipulation.

module.exports.applyPatch = async function applyPatch(ctx) {
  const { vendorRoot, fs, path, console, helpers } = ctx;

  console.log('[StremioPatcher] 001-zentrio-bootstrap.js: starting');

  const targetFile = path.join(vendorRoot, 'src', 'index.js');
  if (!fs.existsSync(targetFile)) {
    console.warn('[StremioPatcher] 001-zentrio-bootstrap.js: target not found, skipping');
    return;
  }

  let source = fs.readFileSync(targetFile, 'utf8');

  // Inject Zentrio session bootstrap code at the beginning of the file
  const bootstrapCode = helpers.readPatchFile('001-zentrio-bootstrap.js', '001-zentrio-bootstrap.js.in');

  // Insert the bootstrap code after the copyright comment but before any other code
  const copyrightEndIndex = source.indexOf('*/');
  if (copyrightEndIndex !== -1) {
    source = source.slice(0, copyrightEndIndex + 2) + bootstrapCode + source.slice(copyrightEndIndex + 2);
  } else {
    // Fallback: insert at the very beginning
    source = bootstrapCode + source;
  }

  fs.writeFileSync(targetFile, source, 'utf8');
  console.log('[StremioPatcher] 001-zentrio-bootstrap.js: patched', targetFile);
  console.log('[StremioPatcher] 001-zentrio-bootstrap.js: finished');
};