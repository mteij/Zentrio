# Scripts

This directory contains automation scripts for managing the Zentrio project.

## Quick Sync

**`bun run sync`** - Runs both sync scripts in the correct order:
1. Syncs application version across project files (`sync-version.ts`)
2. Syncs Tauri plugin versions between Rust crates and NPM packages (`sync-tauri-plugins.ts`)

Use this command for a complete sync before committing or building.

## sync-version.ts

Synchronizes the application version across all project files:
- `app/package.json` (source of truth)
- `app/src-tauri/tauri.conf.json`
- `app/src-tauri/package.json`
- `app/src-tauri/Cargo.toml`

### Usage

```bash
bun run sync-version
```

Automatically runs after `npm version` via the `postversion` hook.

## sync-tauri-plugins.ts

Synchronizes Tauri plugin versions between Rust crates (`Cargo.toml`/`Cargo.lock`) and NPM packages (`package.json`).

This prevents build errors caused by version mismatches between Tauri plugin Rust crates and their corresponding NPM packages.

### Why This Is Needed

Tauri requires that Rust crate versions and NPM package versions be on the same major/minor releases. When they drift apart, builds fail with errors like:

```
Found version mismatched Tauri packages. Make sure the NPM package and Rust crate versions are on the same major/minor releases:
tauri-plugin-dialog (v2.4.2) : @tauri-apps/plugin-dialog (v2.6.0)
```

### Usage

```bash
bun run sync:tauri-plugins
```

### How It Works

1. Scans `Cargo.lock` to get the actual resolved Rust crate versions
2. Compares them with versions in `package.json`
3. Updates `package.json` dependencies to match the Rust crate versions
4. Runs `bun install` to update the lockfile

### Automatic Prevention

The script is automatically run in the following scenarios to prevent version mismatches:

**Local Development:**
- Before `bun run tauri:dev`
- Before `bun run tauri:build`
- After version bumps (`postversion` hook)

**CI/CD:**
- Before each Tauri build in GitHub Actions (`.github/workflows/tauri-build.yml`)

### Best Practices

1. **Always run the sync script after updating Tauri dependencies:**
   ```bash
   bun add @tauri-apps/plugin-dialog
   bun run sync:tauri-plugins
   ```

2. **Run the script before committing if you've modified `Cargo.toml`:**
   ```bash
   git add src-tauri/Cargo.toml
   bun run sync:tauri-plugins
   git add package.json bun.lock
   ```

3. **If a build fails with version mismatch, run:**
   ```bash
   bun run sync:tauri-plugins
   bun run tauri:build
   ```

## Manual Troubleshooting

If you encounter version mismatch issues that the script doesn't resolve:

1. Check current versions:
   ```bash
   bun run tauri info
   ```

2. Manually update the mismatched plugin in `package.json`
3. Run `bun install`
4. Verify with `bun run tauri info` again
