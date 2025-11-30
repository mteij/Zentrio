import { join } from 'path';
import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';

const APP_DIR = join(process.cwd());
const TAURI_DIR = join(APP_DIR, 'src-tauri');

// Files to update
const PACKAGE_JSON = join(APP_DIR, 'package.json');
const TAURI_CONF = join(TAURI_DIR, 'tauri.conf.json');
const TAURI_PACKAGE_JSON = join(TAURI_DIR, 'package.json');
const CARGO_TOML = join(TAURI_DIR, 'Cargo.toml');

function updateJsonFile(path: string, version: string) {
  try {
    const content = readFileSync(path, 'utf-8');
    const json = JSON.parse(content);
    
    if (json.version === version) {
      console.log(`Skipping ${path} (already at ${version})`);
      return;
    }

    json.version = version;
    writeFileSync(path, JSON.stringify(json, null, 2) + '\n');
    console.log(`Updated ${path} to ${version}`);
  } catch (error) {
    console.error(`Failed to update ${path}:`, error);
  }
}

function updateCargoToml(path: string, version: string) {
  try {
    let content = readFileSync(path, 'utf-8');
    
    // Regex to match version = "x.y.z" inside [package] section
    // This is a simple regex and assumes standard Cargo.toml formatting
    const versionRegex = /^version\s*=\s*"(.*)"/m;
    
    const match = content.match(versionRegex);
    if (match && match[1] === version) {
      console.log(`Skipping ${path} (already at ${version})`);
      return;
    }

    content = content.replace(versionRegex, `version = "${version}"`);
    writeFileSync(path, content);
    console.log(`Updated ${path} to ${version}`);
    
    // Run cargo check to update Cargo.lock
    console.log('Running cargo check to update Cargo.lock...');
    try {
        execSync('cargo check', { cwd: TAURI_DIR, stdio: 'inherit' });
    } catch (e) {
        console.warn('Warning: Failed to run cargo check. You may need to update Cargo.lock manually.');
    }

  } catch (error) {
    console.error(`Failed to update ${path}:`, error);
  }
}

function main() {
  try {
    // Read source version from app/package.json
    const packageJson = JSON.parse(readFileSync(PACKAGE_JSON, 'utf-8'));
    const version = packageJson.version;

    if (!version) {
      console.error('Error: No version found in package.json');
      process.exit(1);
    }

    console.log(`Syncing version ${version} across project...`);

    // Update tauri.conf.json
    updateJsonFile(TAURI_CONF, version);

    // Update src-tauri/package.json
    updateJsonFile(TAURI_PACKAGE_JSON, version);

    // Update Cargo.toml
    updateCargoToml(CARGO_TOML, version);

    console.log('Version sync complete!');
  } catch (error) {
    console.error('Error syncing version:', error);
    process.exit(1);
  }
}

main();