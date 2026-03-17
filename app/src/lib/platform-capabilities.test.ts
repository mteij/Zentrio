import { describe, expect, it } from 'vitest'
import { getPlatformCapabilities } from './platform-capabilities'
import type { AppTarget } from './app-target'

function makeTarget(partial: Partial<AppTarget>): AppTarget {
  return {
    kind: 'web',
    os: 'unknown',
    isTauri: false,
    isDesktop: false,
    isMobile: false,
    isTv: false,
    hasTouch: false,
    supportsHover: true,
    supportsOrientationLock: false,
    primaryInput: 'mouse',
    ...partial,
  }
}

describe('getPlatformCapabilities', () => {
  it('shows titlebar only for tauri desktop targets', () => {
    expect(getPlatformCapabilities(makeTarget({
      kind: 'desktop',
      os: 'windows',
      isTauri: true,
      isDesktop: true,
    })).shouldShowTitleBar).toBe(true)

    expect(getPlatformCapabilities(makeTarget({
      kind: 'tv',
      os: 'android',
      isTauri: true,
      isTv: true,
      primaryInput: 'remote',
    })).shouldShowTitleBar).toBe(false)
  })

  it('marks tv targets for tv home and remote navigation', () => {
    const capabilities = getPlatformCapabilities(makeTarget({
      kind: 'tv',
      os: 'android',
      isTauri: true,
      isTv: true,
      primaryInput: 'remote',
    }))

    expect(capabilities.shouldUseTvHome).toBe(true)
    expect(capabilities.canUseRemoteNavigation).toBe(true)
    expect(capabilities.supportsTouchGestures).toBe(false)
  })
})
