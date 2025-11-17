# Zentrio Stremio Web patches

This directory contains build-time patches applied to the vendored Stremio Web project under `app/vendor/stremio-web`.

## How the patch runner works

- The script `app/scripts/apply-stremio-patches.js` is executed during the app build.
- It locates the vendor checkout at `app/vendor/stremio-web`.
- It scans this directory for `*.js` files whose names start with a numeric prefix (e.g. `001-...`, `010-...`).
- Files are sorted lexicographically and executed in that order.
- Each patch file must export an `async function applyPatch(ctx)` or `module.exports.applyPatch = (ctx) => { ... }`.

Where `ctx` is:

- `vendorRoot`: absolute path to `app/vendor/stremio-web`.
- `patchesDir`: absolute path to this directory.
- `fs`: Node's `fs` module.
- `path`: Node's `path` module.
- `console`: standard console for logging.

## Naming and ordering

- Use a three-digit numeric prefix followed by a short kebab-case description.
- Examples:
  - `001-zentrio-bootstrap.js` – core runtime/bootstrap wiring (session, querystring parsing, bridge entrypoints).
  - `010-ui-header-integration.js` – header/profile logo integration.
  - `020-addon-manager.js` – Addon Manager integration.
  - `030-downloads-manager.js` – Downloads Manager integration.
  - `040-nsfw-filter.js` – NSFW filter integration.

This prefix controls patch execution order; keep gaps between numbers so future patches can be inserted without renaming everything.

## Patch responsibilities

Patches should be small and focused:

- Prefer to patch specific source files (e.g. entrypoints, React components) instead of doing broad regex replacements over the entire tree.
- Keep DOM surgery to a minimum; favour using the existing component/state system in Stremio Web.
- Avoid committing generated build artefacts – only patch files in the source tree that the vendor build will consume.

## Example patch skeleton

```js
module.exports.applyPatch = async function applyPatch(ctx) {
  const { vendorRoot, fs, path, console } = ctx;

  // Example: patch a JS file by simple string replacement
  const targetFile = path.join(vendorRoot, 'src', 'index.js');
  if (!fs.existsSync(targetFile)) {
    console.warn('[StremioPatcher] index.js not found, skipping example patch');
    return;
  }

  let source = fs.readFileSync(targetFile, 'utf8');
  // TODO: apply your modifications here
  source = source.replace('// ORIGINAL LINE', "// Patched line by Zentrio\n");

  fs.writeFileSync(targetFile, source, 'utf8');
  console.log('[StremioPatcher] Example patch applied to src/index.js');
}
```

Over time we will gradually move the currently injected DOM scripts (session bootstrap, header tweaks, Addon Manager, Downloads Manager, NSFW filter) into proper patches in this directory.