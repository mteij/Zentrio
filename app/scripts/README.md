# Zentrio Build Scripts

This directory contains scripts for building and setting up the Zentrio application.

## Scripts Overview

### `build.js`
Main build script that:
- Cleans and creates the dist directory
- Copies static assets
- Builds the server with Bun
- Sets up and builds Stremio Web with patches applied

### `setup-stremio-web.js`
New script that replaces the git submodule approach:
- Downloads a fresh copy of stremio-web from GitHub
- Can use specific versions via environment variable `STREMIO_WEB_VERSION`
- Applies patches in a clean, idempotent way
- Installs dependencies

### `apply-stremio-patches.js` (Legacy)
Old patch application script that:
- Appends patches to the vendored stremio-web source
- Is no longer used in the main build process
- Kept for reference and potential manual use

## New Stremio Web Integration

We've moved away from git submodules to a cleaner approach:

1. **Fresh Download**: Each build downloads a fresh copy of stremio-web
2. **Version Control**: Use `STREMIO_WEB_VERSION` environment variable to target specific versions
3. **Clean Patching**: Patches are applied idempotently - running multiple times won't duplicate patches
4. **No Git History**: The downloaded copy is a clean extraction without git history

### Usage

```bash
# Build with default version
npm run build

# Build with specific stremio-web version
STREMIO_WEB_VERSION=v5.0.0 npm run build

# Setup stremio-web manually (without full build)
node scripts/setup-stremio-web.js
```

### Benefits

- **No Submodule Issues**: No more git submodule complexity
- **Clean State**: Always starts with a fresh, unmodified stremio-web
- **Idempotent Patches**: Patches can be applied multiple times without issues
- **Version Flexibility**: Easy to test different stremio-web versions
- **Simplified Workflow**: No need to manage submodule updates

## Patch System

Patches are stored in `../stremio-patches/` and are applied in numerical order:
- `001-zentrio-bootstrap.js` - Core session and API proxy setup
- `010-ui-header-integration.js` - UI modifications and profile integration
- `020-addon-manager.js` - Addon Manager integration
- `030-downloads-manager.js` - Downloads Manager feature (includes stream data integration)
- `040-nsfw-filter.js` - NSFW content filtering

Each patch is client-side JavaScript that gets injected into the Stremio Web build.