export function isTauriRuntime(): boolean {
  return typeof window !== 'undefined'
    && (
      (window as any).__TAURI_INTERNALS__ !== undefined
      || (window as any).__TAURI__ !== undefined
      || (window as any).__TAURI_IPC__ !== undefined
    )
}

interface WaitForTauriOptions {
  attempts?: number
  intervalMs?: number
}

export async function waitForTauriRuntime(options: WaitForTauriOptions = {}): Promise<boolean> {
  const attempts = options.attempts ?? 5
  const intervalMs = options.intervalMs ?? 50

  if (typeof window === 'undefined') {
    return false
  }

  if (isTauriRuntime()) {
    return true
  }

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    await new Promise((resolve) => window.setTimeout(resolve, intervalMs))

    if (isTauriRuntime()) {
      return true
    }
  }

  return isTauriRuntime()
}
