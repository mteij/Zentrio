import { afterEach, describe, expect, it, vi } from 'vitest'

const mockIsTauriRuntime = vi.fn<() => boolean>()
const mockGetAppTarget = vi.fn()

vi.mock('../../../lib/runtime-env', () => ({
  isTauriRuntime: () => mockIsTauriRuntime(),
}))

vi.mock('../../../lib/app-target', () => ({
  getAppTarget: () => mockGetAppTarget(),
}))

import { AndroidNativePlayerEngine } from './AndroidNativePlayerEngine'
import { TauriPlayerEngine } from './TauriPlayerEngine'
import { WebPlayerEngine } from './WebPlayerEngine'
import { createEngineByType, detectEngineType, getDefaultEngineType } from './factory'

describe('player engine factory', () => {
  afterEach(() => {
    mockIsTauriRuntime.mockReset()
    mockGetAppTarget.mockReset()
  })

  it('routes Android phones to the Android native engine', async () => {
    mockIsTauriRuntime.mockReturnValue(true)
    mockGetAppTarget.mockReturnValue({
      isTv: false,
      os: 'android',
    })

    await expect(detectEngineType({ src: 'https://example.com/video.mp4' })).resolves.toBe('android-native')
    expect(getDefaultEngineType()).toBe('android-native')

    const engine = await createEngineByType('web')
    expect(engine).toBeInstanceOf(AndroidNativePlayerEngine)
  })

  it('routes Android TV to the Android native engine', async () => {
    mockIsTauriRuntime.mockReturnValue(true)
    mockGetAppTarget.mockReturnValue({
      isTv: true,
      os: 'android',
    })

    await expect(detectEngineType({ src: 'https://example.com/video.m3u8' })).resolves.toBe('android-native')
    expect(getDefaultEngineType()).toBe('android-native')
  })

  it('keeps desktop Tauri on the system decoder engine', async () => {
    mockIsTauriRuntime.mockReturnValue(true)
    mockGetAppTarget.mockReturnValue({
      isTv: false,
      os: 'windows',
    })

    await expect(detectEngineType({ src: 'https://example.com/video.mp4' })).resolves.toBe('tauri')
    expect(getDefaultEngineType()).toBe('tauri')

    const engine = await createEngineByType('web')
    expect(engine).toBeInstanceOf(TauriPlayerEngine)
  })

  it('keeps browsers on the web engine by default', async () => {
    mockIsTauriRuntime.mockReturnValue(false)
    mockGetAppTarget.mockReturnValue({
      isTv: false,
      os: 'unknown',
    })

    await expect(detectEngineType({ src: 'https://example.com/video.mp4' }, { enableHybrid: false })).resolves.toBe('web')
    expect(getDefaultEngineType()).toBe('web')

    const engine = await createEngineByType('web')
    expect(engine).toBeInstanceOf(WebPlayerEngine)
  })
})
