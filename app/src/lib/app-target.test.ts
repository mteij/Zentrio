import { describe, expect, it } from 'vitest'
import { detectAppTarget } from './app-target'

describe('detectAppTarget', () => {
  it('classifies Chromecast with Google TV style user agents as tv', () => {
    const target = detectAppTarget({
      userAgent: 'Mozilla/5.0 (Linux; Android 14; Chromecast) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
      platform: 'Linux armv8l',
      maxTouchPoints: 0,
      innerWidth: 1920,
      hasTouchEvent: false,
      hasTauri: true,
      hoverMedia: { matches: false },
      coarsePointerMedia: { matches: false },
    })

    expect(target.kind).toBe('tv')
    expect(target.isTv).toBe(true)
    expect(target.primaryInput).toBe('remote')
    expect(target.hasTouch).toBe(false)
  })

  it('classifies Android phones as mobile', () => {
    const target = detectAppTarget({
      userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0 Mobile Safari/537.36',
      platform: 'Linux armv8l',
      maxTouchPoints: 5,
      innerWidth: 412,
      hasTouchEvent: true,
      hasTauri: true,
      hoverMedia: { matches: false },
      coarsePointerMedia: { matches: true },
    })

    expect(target.kind).toBe('mobile')
    expect(target.isMobile).toBe(true)
    expect(target.supportsOrientationLock).toBe(true)
    expect(target.primaryInput).toBe('touch')
  })

  it('classifies Android Tauri shells with remote-like input as tv even without a TV user agent', () => {
    const target = detectAppTarget({
      userAgent: 'Mozilla/5.0 (Linux; Android 14; sdk_gtv_x86) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/113.0.0.0 Safari/537.36',
      platform: 'Linux x86',
      maxTouchPoints: 5,
      innerWidth: 1920,
      hasTouchEvent: true,
      hasTauri: true,
      hoverMedia: { matches: false },
      coarsePointerMedia: { matches: true },
    })

    expect(target.kind).toBe('tv')
    expect(target.isTv).toBe(true)
    expect(target.primaryInput).toBe('remote')
    expect(target.hasTouch).toBe(false)
  })

  it('trusts the native Android TV override when it is available', () => {
    const target = detectAppTarget({
      userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0 Mobile Safari/537.36',
      platform: 'Linux armv8l',
      maxTouchPoints: 5,
      innerWidth: 412,
      hasTouchEvent: true,
      hasTauri: true,
      hoverMedia: { matches: false },
      coarsePointerMedia: { matches: true },
      nativeTv: true,
    })

    expect(target.kind).toBe('tv')
    expect(target.isTv).toBe(true)
    expect(target.primaryInput).toBe('remote')
    expect(target.hasTouch).toBe(false)
  })

  it('classifies Tauri desktop builds as desktop', () => {
    const target = detectAppTarget({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
      platform: 'Win32',
      maxTouchPoints: 0,
      innerWidth: 1440,
      hasTouchEvent: false,
      hasTauri: true,
      hoverMedia: { matches: true },
      coarsePointerMedia: { matches: false },
    })

    expect(target.kind).toBe('desktop')
    expect(target.isDesktop).toBe(true)
    expect(target.primaryInput).toBe('mouse')
  })
})
