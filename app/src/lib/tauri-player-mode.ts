import { isTauriRuntime } from './runtime-env'

export type PlayerOrientationMode = 'auto' | 'landscape' | 'portrait'

const isTauriMobile = () => {
  return isTauriRuntime()
}

export const getStoredPlayerOrientation = (): PlayerOrientationMode => {
  try {
    const saved = localStorage.getItem('zentrio_orientation')
    if (saved === 'auto' || saved === 'landscape' || saved === 'portrait') {
      return saved
    }
  } catch (_e) {}

  return 'landscape'
}

export const setTauriPlayerMode = async (
  enabled: boolean,
  orientation: PlayerOrientationMode = 'auto',
) => {
  if (!isTauriMobile()) return

  try {
    const { invoke } = await import('@tauri-apps/api/core')
    await invoke('immersive_mode_set_player_mode', { enabled, orientation })
  } catch (_e) {
    // Plugin unavailable - silently ignore on non-Android or older builds
  }
}
