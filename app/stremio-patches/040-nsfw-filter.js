'use strict';

// Zentrio NSFW Filter patch for vendored Stremio Web.
//
// This patch injects the NSFW filter functionality directly into the main entrypoint
// instead of injecting it at runtime via DOM manipulation.

module.exports.applyPatch = async function applyPatch(ctx) {
  const { vendorRoot, fs, path, console, helpers } = ctx;

  console.log('[StremioPatcher] 040-nsfw-filter.js: starting');

  const targetFile = path.join(vendorRoot, 'src', 'index.js');
  if (!fs.existsSync(targetFile)) {
    console.warn('[StremioPatcher] 040-nsfw-filter.js: target not found, skipping');
    return;
  }

  let source = fs.readFileSync(targetFile, 'utf8');

  // Inject Zentrio NSFW Filter code after the downloads manager
  const nsfwFilterCode = helpers.readPatchFile('040-nsfw-filter.js', '040-nsfw-filter.js.in');

  // Insert the NSFW filter code after the downloads manager code
  const downloadsManagerEndIndex = source.indexOf('})();', source.indexOf('Downloads Manager - patched in at build-time'));
  if (downloadsManagerEndIndex !== -1) {
    source = source.slice(0, downloadsManagerEndIndex + 4) + nsfwFilterCode + source.slice(downloadsManagerEndIndex + 4);
  } else {
    // Fallback: insert before the first require statement
    const requireIndex = source.indexOf('const Bowser = require');
    if (requireIndex !== -1) {
      source = source.slice(0, requireIndex) + nsfwFilterCode + source.slice(requireIndex);
    } else {
      // Last resort: insert at the beginning
      source = nsfwFilterCode + source;
    }
  }

  fs.writeFileSync(targetFile, source, 'utf8');
  console.log('[StremioPatcher] 040-nsfw-filter.js: patched', targetFile);
  console.log('[StremioPatcher] 040-nsfw-filter.js: finished');
};