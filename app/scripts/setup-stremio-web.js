#!/usr/bin/env node

// Zentrio - Stremio Web setup script
//
// This script downloads a fresh copy of stremio-web and applies patches
// in a clean, idempotent way.

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const https = require('https');

const STREMIO_WEB_VERSION = 'v5.0.0-beta.27'; // Fallback version if API fails
const STREMIO_WEB_REPO = 'https://github.com/Stremio/stremio-web.git';
const TEMP_DIR = path.join(__dirname, '..', '.temp-stremio-web');
const VENDOR_DIR = path.join(__dirname, '..', 'vendor', 'stremio-web');

async function getLatestStremioVersion() {
  console.log('[StremioSetup] Checking for latest Stremio Web version...');
  
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: '/repos/Stremio/stremio-web/releases',
      method: 'GET',
      headers: {
        'User-Agent': 'Zentrio-Build-Script',
        'Accept': 'application/vnd.github.v3+json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          if (res.statusCode === 200) {
            const releases = JSON.parse(data);
            if (releases && releases.length > 0) {
              // Get the first release (latest) from the list
              const latestRelease = releases[0];
              
              if (latestRelease && latestRelease.tag_name) {
                console.log(`[StremioSetup] Found latest version: ${latestRelease.tag_name}`);
                resolve(latestRelease.tag_name);
                return;
              }
            }
          }
          
          console.log(`[StremioSetup] API request failed with status ${res.statusCode}, using fallback version`);
          resolve(STREMIO_WEB_VERSION);
        } catch (error) {
          console.log('[StremioSetup] Failed to parse API response, using fallback version:', error.message);
          resolve(STREMIO_WEB_VERSION);
        }
      });
    });

    req.on('error', (error) => {
      console.log('[StremioSetup] API request failed, using fallback version:', error.message);
      resolve(STREMIO_WEB_VERSION);
    });

    req.setTimeout(10000, () => {
      req.destroy();
      console.log('[StremioSetup] API request timed out, using fallback version');
      resolve(STREMIO_WEB_VERSION);
    });

    req.end();
  });
}

async function removeDirectoryWithRetry(targetDir, maxRetries = 3, delay = 1000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      fs.rmSync(targetDir, { recursive: true, force: true });
      console.log('[StremioSetup] Successfully removed existing directory');
      return;
    } catch (error) {
      if (attempt === maxRetries) {
        console.error(`[StremioSetup] Failed to remove directory after ${maxRetries} attempts:`, error.message);
        
        // On Windows, try using rimraf as a fallback
        if (process.platform === 'win32') {
          try {
            console.log('[StremioSetup] Trying Windows-specific cleanup...');
            const { execSync } = require('child_process');
            execSync(`rmdir /s /q "${targetDir}"`, { stdio: 'pipe' });
            console.log('[StremioSetup] Windows cleanup successful');
            return;
          } catch (windowsError) {
            console.error('[StremioSetup] Windows cleanup also failed:', windowsError.message);
          }
        }
        
        throw error;
      }
      
      console.log(`[StremioSetup] Attempt ${attempt} failed, retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 2; // Exponential backoff
    }
  }
}

async function cloneOrUpdateRepo(repoUrl, targetDir, version = null) {
  console.log('[StremioSetup] Setting up stremio-web repository...');
  
  const parentDir = path.dirname(targetDir);
  const baseName = path.basename(targetDir);
  const tempCloneDir = path.join(parentDir, `${baseName}-clone-${Date.now()}`);
  
  try {
    // Remove existing directory if it exists
    if (fs.existsSync(targetDir)) {
      console.log('[StremioSetup] Removing existing directory...');
      await removeDirectoryWithRetry(targetDir);
      
      // Double-check that directory is actually gone
      if (fs.existsSync(targetDir)) {
        console.log('[StremioSetup] Directory still exists, trying alternative approach...');
        const tempDir = path.join(parentDir, `${baseName}-temp-${Date.now()}`);
        
        // Try to rename the problematic directory
        try {
          fs.renameSync(targetDir, tempDir);
          console.log('[StremioSetup] Renamed problematic directory to temp location');
          
          // Schedule async deletion of temp directory
          setTimeout(() => {
            try {
              fs.rmSync(tempDir, { recursive: true, force: true });
            } catch (e) {
              // Ignore - Windows will eventually clean this up
            }
          }, 5000);
        } catch (renameError) {
          console.warn('[StremioSetup] Could not rename directory, continuing anyway');
        }
      }
    }
    
    // Always use git clone into temporary directory first
    console.log('[StremioSetup] Cloning from git repository...');
    execSync(`git clone ${repoUrl} "${tempCloneDir}"`, { stdio: 'inherit' });
    
    if (version) {
      execSync(`git checkout ${version}`, { cwd: tempCloneDir, stdio: 'inherit' });
    }
    
    // Remove .git directory to make it a clean copy
    const gitDir = path.join(tempCloneDir, '.git');
    if (fs.existsSync(gitDir)) {
      fs.rmSync(gitDir, { recursive: true, force: true });
    }
    
    // If target directory still exists (Windows issue), try one more cleanup
    if (fs.existsSync(targetDir)) {
      console.log('[StremioSetup] Final cleanup attempt for target directory...');
      await removeDirectoryWithRetry(targetDir);
    }
    
    // Move the cloned directory to the final location
    if (fs.existsSync(targetDir)) {
      console.log('[StremioSetup] Target directory still exists, using rename strategy...');
      const backupDir = path.join(parentDir, `${baseName}-backup-${Date.now()}`);
      fs.renameSync(targetDir, backupDir);
      fs.renameSync(tempCloneDir, targetDir);
      
      // Schedule cleanup of backup directory
      setTimeout(() => {
        try {
          fs.rmSync(backupDir, { recursive: true, force: true });
        } catch (e) {
          // Ignore
        }
      }, 5000);
    } else {
      fs.renameSync(tempCloneDir, targetDir);
    }
    
    console.log('[StremioSetup] Successfully set up stremio-web repository');
    
  } catch (error) {
    // Clean up temporary directory if it exists
    if (fs.existsSync(tempCloneDir)) {
      try {
        fs.rmSync(tempCloneDir, { recursive: true, force: true });
      } catch (e) {
        // Ignore cleanup errors
      }
    }
    throw error;
  }
}

async function applyPatchesCleanly(vendorDir, patchesDir) {
  console.log('[StremioSetup] Applying patches cleanly...');
  
  const targetFile = path.join(vendorDir, 'src', 'index.js');
  
  if (!fs.existsSync(targetFile)) {
    throw new Error(`Target file not found: ${targetFile}`);
  }
  
  // Read the original file
  const originalContent = fs.readFileSync(targetFile, 'utf8');
  
  // Check if patches are already applied
  if (originalContent.includes('=== ZENTRIO PATCHES START ===')) {
    console.log('[StremioSetup] Removing existing patches...');
    // Remove existing patches
    const cleanContent = originalContent.split('=== ZENTRIO PATCHES START ===')[0];
    fs.writeFileSync(targetFile, cleanContent, 'utf8');
  }
  
  // Get patch files
  const patchFiles = fs
    .readdirSync(patchesDir)
    .filter((file) => file.match(/^\d+.*\.js$/i))
    .sort();
  
  if (patchFiles.length === 0) {
    console.log('[StremioSetup] No patch files found');
    return;
  }
  
  // Concatenate all patch files
  let allPatches = '\n\n// === ZENTRIO PATCHES START ===\n';
  for (const file of patchFiles) {
    const codeFilePath = path.join(patchesDir, file);
    const content = fs.readFileSync(codeFilePath, 'utf8');
    allPatches += `\n// Injected from: ${file}\n`;
    allPatches += content;
    allPatches += '\n';
  }
  allPatches += '// === ZENTRIO PATCHES END ===\n';
  
  // Append patches to the file
  fs.appendFileSync(targetFile, allPatches, 'utf8');
  
  console.log(`[StremioSetup] Successfully applied ${patchFiles.length} patches`);
}

async function main() {
  const appRoot = path.join(__dirname, '..');
  const vendorDir = path.join(appRoot, 'vendor', 'stremio-web');
  const patchesDir = path.join(appRoot, 'stremio-patches');
  
  try {
    console.log('[StremioSetup] Starting fresh stremio-web setup...');
    
    // Check if patches directory exists
    if (!fs.existsSync(patchesDir)) {
      console.log('[StremioSetup] stremio-patches directory not found, skipping patching');
      return;
    }
    
    // Get version from environment variable, dynamic check, or use default
    let version = process.env.STREMIO_WEB_VERSION;
    if (!version) {
      version = await getLatestStremioVersion();
    }
    console.log(`[StremioSetup] Using stremio-web version: ${version}`);
    
    // Download/clone fresh stremio-web
    await cloneOrUpdateRepo(STREMIO_WEB_REPO, vendorDir, version);
    
    // Install dependencies
    console.log('[StremioSetup] Installing dependencies...');
    try {
      execSync('npm install --legacy-peer-deps', { cwd: vendorDir, stdio: 'inherit' });
      
      // Try to install missing critical dependencies if they're still missing
      const criticalDeps = ['@babel/core', '@nodelib/fs.walk', 'enhanced-resolve', 'fast-uri'];
      for (const dep of criticalDeps) {
        try {
          require.resolve(path.join(vendorDir, 'node_modules', dep));
        } catch (e) {
          console.log(`[StremioSetup] Installing missing critical dependency: ${dep}`);
          execSync(`npm install ${dep}`, { cwd: vendorDir, stdio: 'inherit' });
        }
      }
    } catch (error) {
      console.error('[StremioSetup] Failed to install dependencies:', error.message);
      throw error;
    }
    
    // Apply patches cleanly
    await applyPatchesCleanly(vendorDir, patchesDir);
    
    console.log('[StremioSetup] Setup completed successfully!');
    
  } catch (error) {
    console.error('[StremioSetup] Setup failed:', error);
    process.exit(1);
  }
}

// Clean up temp directory on exit
process.on('exit', () => {
  if (fs.existsSync(TEMP_DIR)) {
    try {
      fs.rmSync(TEMP_DIR, { recursive: true, force: true });
    } catch (e) {
      // Ignore cleanup errors
    }
  }
});

main().catch((err) => {
  console.error('[StremioSetup] Failed to setup stremio-web', err);
  process.exit(1);
});