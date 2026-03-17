import { getAppTarget, type AppTarget } from './app-target'

export interface PlatformCapabilities extends AppTarget {
  canUseNativeShell: boolean
  canUseDesktopWindowControls: boolean
  shouldShowTitleBar: boolean
  shouldUseTvHome: boolean
  canUseRemoteNavigation: boolean
  supportsTouchGestures: boolean
}

export function getPlatformCapabilities(target: AppTarget = getAppTarget()): PlatformCapabilities {
  const canUseNativeShell = target.isTauri
  const canUseDesktopWindowControls = canUseNativeShell && target.isDesktop

  return {
    ...target,
    canUseNativeShell,
    canUseDesktopWindowControls,
    shouldShowTitleBar: canUseDesktopWindowControls,
    shouldUseTvHome: target.isTv,
    canUseRemoteNavigation: target.primaryInput === 'remote',
    supportsTouchGestures: target.hasTouch && !target.isTv,
  }
}
