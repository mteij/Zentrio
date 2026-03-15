export type PlayerOrientationMode = 'auto' | 'landscape' | 'portrait'

const isTauriMobile = () => {
  if (typeof window === 'undefined') return false
  return !!(window.__TAURI__ || window.__TAURI_INTERNALS__)
}

export const getStoredPlayerOrientation = (): PlayerOrientationMode => {
  try {
    const saved = localStorage.getItem('zentrio_orientation')
    if (saved === 'auto' || saved === 'landscape' || saved === 'portrait') {
      return saved
    }
  } catch (e) {}

  return 'landscape'
}

export const setTauriPlayerMode = async (
  enabled: boolean,
  orientation: PlayerOrientationMode = 'auto',
) => {
  if (!isTauriMobile()) return

  try {
    const { invoke } = await import('@tauri-apps/api/core')
    await invoke('plugin:immersive-mode|setPlayerMode', { enabled, orientation })
  } catch (e) {
    // Plugin unavailable - silently ignore on non-Android or older builds
  }
}
