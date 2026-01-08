import { execSync } from 'child_process';
import { join } from 'path';
import { existsSync } from 'fs';

const ADB_PATHS = [
  join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk', 'platform-tools', 'adb.exe'),
  join(process.env.ANDROID_HOME || '', 'platform-tools', 'adb.exe'),
  join(process.env.ANDROID_SDK_ROOT || '', 'platform-tools', 'adb.exe'),
];

function findAdb(): string | null {
  for (const path of ADB_PATHS) {
    if (existsSync(path)) {
      return path;
    }
  }
  return null;
}

function main() {
  const adbPath = findAdb();
  
  if (!adbPath) {
    console.error('❌ Could not find adb.exe. Make sure Android SDK is installed.');
    console.error('   Searched paths:', ADB_PATHS.filter(p => p).join('\n   '));
    process.exit(1);
  }

  console.log(`📱 Found adb at: ${adbPath}`);
  
  const ports = [5173, 3000]; // Vite dev server + backend
  
  for (const port of ports) {
    try {
      execSync(`"${adbPath}" reverse tcp:${port} tcp:${port}`, { stdio: 'inherit' });
      console.log(`✅ Forwarded port ${port}`);
    } catch (error) {
      console.error(`❌ Failed to forward port ${port}:`, error);
    }
  }
  
  console.log('\n🎉 Android device can now connect to localhost ports!');
}

main();
