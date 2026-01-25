#!/usr/bin/env bun
/**
 * Sync Tauri plugin versions between Cargo.toml and package.json
 * This ensures Rust crate versions match NPM package versions
 */

import { join } from 'path';
import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';

const APP_DIR = join(process.cwd());
const TAURI_DIR = join(APP_DIR, 'src-tauri');

// Files to update
const PACKAGE_JSON = join(APP_DIR, 'package.json');
const CARGO_TOML = join(TAURI_DIR, 'Cargo.toml');

// Mapping of Rust crate names to NPM package names
const PLUGIN_MAPPING: Record<string, string> = {
  'tauri-plugin-dialog': '@tauri-apps/plugin-dialog',
  'tauri-plugin-fs': '@tauri-apps/plugin-fs',
  'tauri-plugin-http': '@tauri-apps/plugin-http',
  'tauri-plugin-notification': '@tauri-apps/plugin-notification',
  'tauri-plugin-opener': '@tauri-apps/plugin-opener',
  'tauri-plugin-os': '@tauri-apps/plugin-os',
  'tauri-plugin-process': '@tauri-apps/plugin-process',
  'tauri-plugin-shell': '@tauri-apps/plugin-shell',
  'tauri-plugin-store': '@tauri-apps/plugin-store',
  'tauri-plugin-deep-link': '@tauri-apps/plugin-deep-link',
  'tauri-plugin-single-instance': '@tauri-apps/plugin-single-instance',
};

interface CargoDependency {
  name: string;
  version: string;
}

/**
 * Parse Cargo.toml to extract plugin versions
 */
function parseCargoToml(path: string): CargoDependency[] {
  const content = readFileSync(path, 'utf-8');
  const lines = content.split(/\r?\n/);
  const dependencies: CargoDependency[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    // Match lines like: tauri-plugin-dialog = "2" or tauri-plugin-dialog = { version = "2.0.0", features = [...] }
    const match = trimmed.match(/^tauri-plugin-(\w[\w-]*)\s*=\s*"([^"]+)"/);
    if (match) {
      const name = `tauri-plugin-${match[1]}`;
      const version = match[2];
      dependencies.push({ name, version });
      continue;
    }

    // Match lines with version in braces: tauri-plugin-dialog = { version = "2.0.0" }
    const braceMatch = trimmed.match(/^tauri-plugin-(\w[\w-]*)\s*=\s*\{\s*version\s*=\s*"([^"]+)"/);
    if (braceMatch) {
      const name = `tauri-plugin-${braceMatch[1]}`;
      const version = braceMatch[2];
      dependencies.push({ name, version });
    }
  }

  return dependencies;
}

/**
 * Get the latest locked version from Cargo.lock for each plugin
 */
function getLockedVersions(cargoDir: string): Record<string, string> {
  const versions: Record<string, string> = {};
  
  try {
    // Read Cargo.lock file directly
    const cargoLockPath = join(cargoDir, 'Cargo.lock');
    const content = readFileSync(cargoLockPath, 'utf-8');
    const lines = content.split(/\r?\n/);
    
    let currentPackage: { name: string | null; version: string | null } = { name: null, version: null };
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Check for package name
      const nameMatch = trimmed.match(/^name\s*=\s*"([^"]+)"/);
      if (nameMatch) {
        currentPackage = { name: nameMatch[1], version: null };
      }
      
      // Check for version
      const versionMatch = trimmed.match(/^version\s*=\s*"(\d+\.\d+\.\d+)"/);
      if (versionMatch && currentPackage.name) {
        currentPackage.version = versionMatch[1];
      }
      
      // When we find an empty line after a package, save it
      if (trimmed === '' && currentPackage.name && currentPackage.version) {
        // Only save Tauri plugins
        if (currentPackage.name.startsWith('tauri-plugin-')) {
          versions[currentPackage.name] = currentPackage.version;
        }
        currentPackage = { name: null, version: null };
      }
    }
  } catch (error) {
    console.warn('Could not get locked versions from Cargo.lock, falling back to Cargo.toml');
  }
  
  return versions;
}

/**
 * Update package.json with new plugin versions
 */
function updatePackageJson(path: string, updates: Record<string, string>): boolean {
  const content = readFileSync(path, 'utf-8');
  const json = JSON.parse(content);
  
  let changed = false;
  
  for (const [rustName, version] of Object.entries(updates)) {
    const npmName = PLUGIN_MAPPING[rustName];
    if (!npmName) {
      continue;
    }
    
    const currentVersion = json.dependencies?.[npmName];
    if (!currentVersion) {
      continue;
    }
    
    // Check if version is already matching (account for ^ prefix)
    const cleanCurrentVersion = currentVersion.replace(/^\^/, '');
    if (cleanCurrentVersion === version) {
      continue;
    }
    
    // Update version with ^ prefix for compatibility
    json.dependencies[npmName] = `^${version}`;
    console.log(`  ${npmName}: ${currentVersion} → ^${version}`);
    changed = true;
  }
  
  if (changed) {
    writeFileSync(path, JSON.stringify(json, null, 2) + '\n');
  }
  
  return changed;
}

function main() {
  try {
    console.log('🔍 Scanning Cargo.toml for Tauri plugins...\n');
    
    // Get versions from Cargo.toml
    const cargoDeps = parseCargoToml(CARGO_TOML);
    
    if (cargoDeps.length === 0) {
      console.log('No Tauri plugins found in Cargo.toml');
      return;
    }
    
    console.log('Found Tauri plugins in Cargo.toml:');
    for (const dep of cargoDeps) {
      console.log(`  - ${dep.name}: ${dep.version}`);
    }
    
    // Get the actual locked versions (more accurate)
    console.log('\n🔒 Checking locked versions from Cargo.lock...');
    const lockedVersions = getLockedVersions(TAURI_DIR);
    
    console.log('Locked versions:');
    for (const [name, version] of Object.entries(lockedVersions)) {
      if (PLUGIN_MAPPING[name]) {
        console.log(`  - ${name}: ${version}`);
      }
    }
    
    // Use locked versions if available, otherwise use Cargo.toml versions
    const versionsToUpdate = { ...lockedVersions };
    for (const dep of cargoDeps) {
      if (!versionsToUpdate[dep.name]) {
        versionsToUpdate[dep.name] = dep.version;
      }
    }
    
    console.log('\n📦 Updating package.json...\n');
    const changed = updatePackageJson(PACKAGE_JSON, versionsToUpdate);
    
    if (changed) {
      console.log('\n✅ package.json updated successfully!');
      console.log('📝 Running bun install to update lockfile...\n');
      execSync('bun install', { cwd: APP_DIR, stdio: 'inherit' });
      console.log('\n✅ All Tauri plugin versions are now synchronized!');
    } else {
      console.log('\n✅ All Tauri plugin versions are already synchronized!');
    }
    
  } catch (error) {
    console.error('\n❌ Error syncing Tauri plugin versions:', error);
    process.exit(1);
  }
}

main();
