import { describe, expect, it, vi } from 'vitest'

const { invokeMock, MockChannel } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  MockChannel: class MockChannel<T> {
    onmessage: ((event: T) => void) | null = null
  },
}))

vi.mock('@tauri-apps/api/core', () => ({
  invoke: invokeMock,
  Channel: MockChannel,
}))

vi.mock('../../../lib/app-target', () => ({
  getAppTarget: () => ({
    isTv: false,
  }),
}))

import { AndroidNativePlayerEngine } from './AndroidNativePlayerEngine'

describe('AndroidNativePlayerEngine', () => {
  it('emits close instead of ended for native back events', () => {
    const engine = new AndroidNativePlayerEngine()
    const close = vi.fn()
    const ended = vi.fn()

    engine.addEventListener('close', close)
    engine.addEventListener('ended', ended)

    ;(engine as any).handleEvent({ type: 'back' })

    expect(close).toHaveBeenCalledWith('back')
    expect(ended).not.toHaveBeenCalled()
  })

  it('still emits ended for natural playback completion', () => {
    const engine = new AndroidNativePlayerEngine()
    const close = vi.fn()
    const ended = vi.fn()

    engine.addEventListener('close', close)
    engine.addEventListener('ended', ended)

    ;(engine as any).handleEvent({
      type: 'statechange',
      state: 'ended',
      currentTimeMs: 42_000,
      durationMs: 42_000,
    })

    expect(ended).toHaveBeenCalledTimes(1)
    expect(close).not.toHaveBeenCalled()
  })
})
