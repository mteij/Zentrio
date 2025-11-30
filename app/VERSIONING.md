# Versioning Strategy for Zentrio

## Overview
Zentrio uses traditional semantic versioning (e.g., `2.0.0-alpha.5`) throughout the project, including in GitHub releases, website, and documentation. The MSI build process automatically converts these versions to an MSI-compatible format.

## Traditional Semantic Versioning

### Version Format
- **Stable releases**: `2.0.0`, `2.1.0`, etc.
- **Alpha releases**: `2.0.0-alpha.1`, `2.0.0-alpha.2`, etc.
- **Beta releases**: `2.0.0-beta.1`, `2.0.0-beta.2`, etc.
- **Release candidates**: `2.0.0-rc.1`, `2.0.0-rc.2`, etc.

### Usage
- Use traditional semantic versioning everywhere in the project
- Update the main `package.json` version using standard npm commands:
  ```bash
  npm version patch    # 2.0.0 -> 2.0.1
  npm version minor    # 2.0.0 -> 2.1.0
  npm version major    # 2.0.0 -> 3.0.0
  npm version 2.0.0-alpha.6  # Set specific prerelease
  ```

## Automatic MSI Conversion

The sync script automatically converts traditional versions to MSI-compatible format for Tauri files:

| Traditional Version | MSI-Compatible Version |
|-------------------|----------------------|
| 2.0.0-alpha.1 | 2.0.0-1001 |
| 2.0.0-alpha.2 | 2.0.0-1002 |
| 2.0.0-beta.1 | 2.0.0-2001 |
| 2.0.0-beta.2 | 2.0.0-2002 |
| 2.0.0-rc.1 | 2.0.0-3001 |
| 2.0.0 | 2.0.0 |

### Conversion Rules
- **Alpha versions**: `alpha.X` → `-1000+X` (e.g., `alpha.5` → `-1005`)
- **Beta versions**: `beta.X` → `-2000+X` (e.g., `beta.1` → `-2001`)
- **RC versions**: `rc.X` → `-3000+X` (e.g., `rc.1` → `-3001`)
- **Stable versions**: No conversion needed

## Workflow

1. **Update version** in `package.json` using npm version commands or manual editing
2. **Run sync script** to automatically update Tauri files:
   ```bash
   npm run sync-version
   ```
3. **Build MSI** - the conversion happens automatically:
   ```bash
   npm run tauri build -- --bundles msi
   ```

## Files Managed by Sync Script
- `app/package.json` - Traditional version (source of truth)
- `app/src-tauri/tauri.conf.json` - MSI-compatible version
- `app/src-tauri/package.json` - MSI-compatible version
- `app/src-tauri/Cargo.toml` - MSI-compatible version

## Current Version
The current version is `2.0.0-alpha.5`, which automatically converts to `2.0.0-1005` for MSI builds.