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

/**
 * Convert traditional semantic version to MSI-compatible format
 * Examples:
 * - "2.0.0-alpha.5" -> "2.0.0-1005"
 * - "2.0.0-beta.1" -> "2.0.0-2001"
 * - "2.0.0-rc.2" -> "2.0.0-3002"
 * - "2.0.0" -> "2.0.0"
 */
function convertToMsiVersion(version: string): string {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)(?:-(alpha|beta|rc)\.(\d+))?$/);
  if (!match) {
    throw new Error(`Invalid version format: ${version}`);
  }
  
  const [, major, minor, patch, prereleaseType, prereleaseNumber] = match;
  
  if (!prereleaseType || !prereleaseNumber) {
    // Stable version, no conversion needed
    return `${major}.${minor}.${patch}`;
  }
  
  let baseNumber: number;
  switch (prereleaseType) {
    case 'alpha':
      baseNumber = 1000;
      break;
    case 'beta':
      baseNumber = 2000;
      break;
    case 'rc':
      baseNumber = 3000;
      break;
    default:
      throw new Error(`Unknown prerelease type: ${prereleaseType}`);
  }
  
  const msiPrerelease = baseNumber + parseInt(prereleaseNumber);
  return `${major}.${minor}.${patch}-${msiPrerelease}`;
}

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
    const traditionalVersion = packageJson.version;

    if (!traditionalVersion) {
      console.error('Error: No version found in package.json');
      process.exit(1);
    }

    console.log(`Syncing version ${traditionalVersion} across project...`);
    
    // Convert to MSI-compatible format for Tauri files
    const msiVersion = convertToMsiVersion(traditionalVersion);
    console.log(`Using MSI-compatible version: ${msiVersion} for Tauri files`);

    // Update tauri.conf.json with MSI version
    updateJsonFile(TAURI_CONF, msiVersion);

    // Update src-tauri/package.json with MSI version
    updateJsonFile(TAURI_PACKAGE_JSON, msiVersion);

    // Update Cargo.toml with MSI version
    updateCargoToml(CARGO_TOML, msiVersion);

    console.log('Version sync complete!');
    console.log(`Traditional version: ${traditionalVersion}`);
    console.log(`MSI-compatible version: ${msiVersion}`);
  } catch (error) {
    console.error('Error syncing version:', error);
    process.exit(1);
  }
}

main();