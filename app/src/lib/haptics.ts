import { vibrate } from '@tauri-apps/plugin-haptics'

function tryVibrate(ms: number) {
  try {
    vibrate(ms).catch(() => { navigator.vibrate?.(ms) })
  } catch {
    navigator.vibrate?.(ms)
  }
}

/** Very short tick — toggle state changes */
export const hapticTick = () => tryVibrate(12)

/** Medium buzz — standard confirmation / context menu long-press */
export const hapticConfirm = () => tryVibrate(50)

/** Longer buzz — destructive actions (delete, cancel) */
export const hapticDestructive = () => tryVibrate(80)

/** Double pulse — success events (download complete) */
export const hapticSuccess = () => {
  if (navigator.vibrate) {
    navigator.vibrate([50, 80, 50])
  } else {
    tryVibrate(100)
  }
}

/** Scrub tick — brief click when crossing a minute boundary while scrubbing */
export const hapticScrubTick = () => tryVibrate(8)
