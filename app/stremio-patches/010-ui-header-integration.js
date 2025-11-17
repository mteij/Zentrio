'use strict';

// Zentrio UI header integration patch for vendored Stremio Web.
//
// This patch injects UI tweaks directly into the main entrypoint
// instead of injecting them at runtime via DOM manipulation.

module.exports.applyPatch = async function applyPatch(ctx) {
  const { vendorRoot, fs, path, console, helpers } = ctx;

  console.log('[StremioPatcher] 010-ui-header-integration.js: starting');

  const targetFile = path.join(vendorRoot, 'src', 'index.js');
  if (!fs.existsSync(targetFile)) {
    console.warn('[StremioPatcher] 010-ui-header-integration.js: target not found, skipping');
    return;
  }

  let source = fs.readFileSync(targetFile, 'utf8');

  // Inject Zentrio UI tweaks code after the bootstrap code
  const uiTweaksCode = helpers.readPatchFile('010-ui-header-integration.js', '010-ui-header-integration.js.in');

  // Insert the UI tweaks code after the bootstrap code (look for the end of the bootstrap IIFE)
  const bootstrapEndIndex = source.indexOf('})();');
  if (bootstrapEndIndex !== -1) {
    source = source.slice(0, bootstrapEndIndex + 4) + uiTweaksCode + source.slice(bootstrapEndIndex + 4);
  } else {
    // Fallback: insert before the first require statement
    const requireIndex = source.indexOf('const Bowser = require');
    if (requireIndex !== -1) {
      source = source.slice(0, requireIndex) + uiTweaksCode + source.slice(requireIndex);
    } else {
      // Last resort: insert at the beginning
      source = uiTweaksCode + source;
    }
  }

  fs.writeFileSync(targetFile, source, 'utf8');
  console.log('[StremioPatcher] 010-ui-header-integration.js: patched', targetFile);
  console.log('[StremioPatcher] 010-ui-header-integration.js: finished');
};