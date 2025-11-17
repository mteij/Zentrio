'use strict';

// Zentrio Downloads Manager patch for vendored Stremio Web.
//
// This patch injects the downloads manager functionality directly into the main entrypoint
// instead of injecting it at runtime via DOM manipulation.

module.exports.applyPatch = async function applyPatch(ctx) {
  const { vendorRoot, fs, path, console, helpers } = ctx;

  console.log('[StremioPatcher] 030-downloads-manager.js: starting');

  const targetFile = path.join(vendorRoot, 'src', 'index.js');
  if (!fs.existsSync(targetFile)) {
    console.warn('[StremioPatcher] 030-downloads-manager.js: target not found, skipping');
    return;
  }

  let source = fs.readFileSync(targetFile, 'utf8');

  // Inject Zentrio Downloads Manager code after the addon manager
  const downloadsManagerCode = helpers.readPatchFile('030-downloads-manager.js', '030-downloads-manager.js.in');

  // Insert the downloads manager code after the addon manager code
  const addonManagerEndIndex = source.indexOf('})();', source.indexOf('Addon Manager - patched in at build-time'));
  if (addonManagerEndIndex !== -1) {
    source = source.slice(0, addonManagerEndIndex + 4) + downloadsManagerCode + source.slice(addonManagerEndIndex + 4);
  } else {
    // Fallback: insert before the first require statement
    const requireIndex = source.indexOf('const Bowser = require');
    if (requireIndex !== -1) {
      source = source.slice(0, requireIndex) + downloadsManagerCode + source.slice(requireIndex);
    } else {
      // Last resort: insert at the beginning
      source = downloadsManagerCode + source;
    }
  }

  fs.writeFileSync(targetFile, source, 'utf8');
  console.log('[StremioPatcher] 030-downloads-manager.js: patched', targetFile);
  console.log('[StremioPatcher] 030-downloads-manager.js: finished');
};