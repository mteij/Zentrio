import { $ } from 'bun'
import { join } from 'path'

const action = process.argv[2]
if (!action) {
  console.error('Usage: bun run scripts/google-tv-runner.ts <build|install|dev|logcat>')
  process.exit(1)
}

const dir = import.meta.dir

if (process.platform === 'win32') {
  await $`powershell -ExecutionPolicy Bypass -File ${join(dir, 'google-tv.ps1')} ${action}`
} else {
  await $`bash ${join(dir, 'google-tv.sh')} ${action}`
}
