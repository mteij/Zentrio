# Zentrio Stremio Web patches

This directory contains build-time patches applied to the vendored Stremio Web project under `app/vendor/stremio-web`.

## New Patch System Architecture

The patch system has been redesigned to solve template string concatenation issues and provide proper syntax formatting:

### Directory Structure
```
app/stremio-patches/
├── utils/
│   └── code-injector.js     # Code injection utility
├── code/                    # Separate JavaScript code files
│   ├── 001-zentrio-bootstrap.js
│   ├── 010-ui-header-integration.js
│   ├── 020-addon-manager.js
│   ├── 030-downloads-manager.js
│   └── 040-nsfw-filter.js
├── 001-zentrio-bootstrap.js    # Patch controllers (no template strings)
├── 010-ui-header-integration.js
├── 020-addon-manager.js
├── 030-downloads-manager.js
├── 040-nsfw-filter.js
└── README.md
```

### Benefits of the New System

1. **Proper Syntax Formatting**: JavaScript code is now in separate `.js` files, allowing editors to provide proper syntax highlighting, formatting, and linting.

2. **No Template String Issues**: Eliminates template string concatenation problems that were breaking builds.

3. **Better Maintainability**: Code is separated into logical files, making it easier to read, edit, and maintain.

4. **Cleaner Patch Files**: Patch controller files are now minimal and focused on injection logic.

5. **Reusable Code**: Code files can be reused or imported by other tools if needed.

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

## Code Injection Utility

The `utils/code-injector.js` provides a clean API for injecting JavaScript code:

```js
const { createInjector } = require('./utils/code-injector');

module.exports.applyPatch = async function applyPatch(ctx) {
  const inject = createInjector(ctx);
  
  // Inject code after a specific string
  inject('my-code-file.js', {
    after: '*/'
  });
  
  // Inject code before a specific string
  inject('my-code-file.js', {
    before: 'const Bowser = require'
  });
  
  // Inject code using regex
  inject('my-code-file.js', {
    after: /UI tweaks - patched in at build-time[\s\S]*?\)\(\);/
  });
};
```

### Injection Options

- `after`: Insert after this string or regex
- `before`: Insert before this string or regex
- `replace`: Replace this string or regex
- `atEnd`: Insert at the end of file
- `atBeginning`: Insert at the beginning of file
- `afterLast`: Insert after last occurrence of this string/regex
- `beforeLast`: Insert before last occurrence of this string/regex

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

## Example patch skeleton (New System)

### Patch Controller (`001-my-patch.js`)
```js
'use strict';

const { createInjector } = require('./utils/code-injector');

module.exports.applyPatch = async function applyPatch(ctx) {
  const { console } = ctx;

  console.log('[StremioPatcher] 001-my-patch.js: starting');

  const inject = createInjector(ctx);
  
  // Inject code after copyright comment
  const success = inject('my-patch-code.js', {
    after: '*/'
  });

  if (success) {
    console.log('[StremioPatcher] 001-my-patch.js: patched successfully');
  } else {
    console.warn('[StremioPatcher] 001-my-patch.js: failed to patch');
  }
  
  console.log('[StremioPatcher] 001-my-patch.js: finished');
};
```

### Code File (`code/my-patch-code.js`)
```js
// My patch code - this file gets proper syntax highlighting!
(function() {
  console.log('My patch is running!');
  
  // Your JavaScript code here with full editor support
  function myFunction() {
    return 'Hello from my patch!';
  }
  
  // No template string escaping issues
  const message = "This is a regular string, no escaping needed!";
  console.log(message);
})();
```

## Migration from Old System

To migrate existing patches with template strings:

1. Extract the JavaScript code from the template string into a new file in the `code/` directory
2. Replace the patch controller to use the new injection system
3. Test that the functionality remains the same

The new system maintains full backward compatibility while providing a much better development experience.

Over time we will gradually move the currently injected DOM scripts (session bootstrap, header tweaks, Addon Manager, Downloads Manager, NSFW filter) into proper patches in this directory.