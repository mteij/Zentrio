import { getAppTarget, type AppTarget } from './app-target'

export type StandardNavPlacement = 'side' | 'bottom' | 'none'

export interface PlatformCapabilities extends AppTarget {
  canUseNativeShell: boolean
  canUseDesktopWindowControls: boolean
  shouldShowTitleBar: boolean
  shouldUseTvHome: boolean
  canUseRemoteNavigation: boolean
  supportsTouchGestures: boolean
  standardNavPlacement: StandardNavPlacement
  shouldUseBottomTabs: boolean
  shouldUseSideRail: boolean
  shouldUseTopAppBar: boolean
}

export function getPlatformCapabilities(target: AppTarget = getAppTarget()): PlatformCapabilities {
  const canUseNativeShell = target.isTauri
  const canUseDesktopWindowControls = canUseNativeShell && target.isDesktop
  const standardNavPlacement: StandardNavPlacement = target.isTv ? 'none' : target.isMobile ? 'bottom' : 'side'

  return {
    ...target,
    canUseNativeShell,
    canUseDesktopWindowControls,
    shouldShowTitleBar: canUseDesktopWindowControls,
    shouldUseTvHome: target.isTv,
    canUseRemoteNavigation: target.primaryInput === 'remote',
    supportsTouchGestures: target.hasTouch && !target.isTv,
    standardNavPlacement,
    shouldUseBottomTabs: standardNavPlacement === 'bottom',
    shouldUseSideRail: standardNavPlacement === 'side',
    shouldUseTopAppBar: !target.isTv,
  }
}
