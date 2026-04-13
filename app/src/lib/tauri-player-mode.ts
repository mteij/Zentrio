import { isTauriRuntime } from './runtime-env'

type PlayerOrientationMode = 'auto' | 'landscape' | 'portrait'

const isTauriMobile = () => {
  return isTauriRuntime()
}

export const setTauriPlayerMode = async (
  enabled: boolean,
  orientation: PlayerOrientationMode = 'auto'
) => {
  if (!isTauriMobile()) return

  try {
    const { invoke } = await import('@tauri-apps/api/core')
    await invoke('immersive_mode_set_player_mode', { enabled, orientation })
  } catch (_e) {
    // Plugin unavailable - silently ignore on non-Android or older builds
  }
}
