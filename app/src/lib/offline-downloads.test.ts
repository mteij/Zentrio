import { describe, expect, it } from 'vitest'
import { canUseOfflineDownloads, readOfflineDownloadsSettings } from './offline-downloads'

describe('offline-downloads helpers', () => {
  it('defaults Android TV downloads to disabled', () => {
    expect(readOfflineDownloadsSettings(undefined)).toEqual({ allowOnTv: false })
    expect(canUseOfflineDownloads({ isTv: true }, undefined)).toBe(false)
  })

  it('allows Android TV downloads when the shared setting is enabled', () => {
    expect(canUseOfflineDownloads({ isTv: true }, { allowOnTv: true })).toBe(true)
  })

  it('keeps downloads available on non-TV targets', () => {
    expect(canUseOfflineDownloads({ isTv: false }, undefined)).toBe(true)
  })
})
