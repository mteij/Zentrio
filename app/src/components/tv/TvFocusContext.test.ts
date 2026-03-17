import { describe, expect, it } from 'vitest'
import { normalizeTvRemoteKey, resolveFallbackFocusIndex, resolveNextItemId } from './TvFocusContext'

describe('resolveNextItemId', () => {
  it('moves left and right in horizontal zones', () => {
    const items = ['a', 'b', 'c']

    expect(resolveNextItemId(items, 'b', { orientation: 'horizontal' }, 'left')).toBe('a')
    expect(resolveNextItemId(items, 'b', { orientation: 'horizontal' }, 'right')).toBe('c')
    expect(resolveNextItemId(items, 'a', { orientation: 'horizontal' }, 'left')).toBeNull()
  })

  it('moves up and down in vertical zones', () => {
    const items = ['a', 'b', 'c']

    expect(resolveNextItemId(items, 'b', { orientation: 'vertical' }, 'up')).toBe('a')
    expect(resolveNextItemId(items, 'b', { orientation: 'vertical' }, 'down')).toBe('c')
    expect(resolveNextItemId(items, 'c', { orientation: 'vertical' }, 'down')).toBeNull()
  })

  it('moves across rows in grid zones', () => {
    const items = ['a', 'b', 'c', 'd', 'e', 'f']
    const zone = { orientation: 'grid' as const, columns: 3 }

    expect(resolveNextItemId(items, 'b', zone, 'right')).toBe('c')
    expect(resolveNextItemId(items, 'b', zone, 'left')).toBe('a')
    expect(resolveNextItemId(items, 'b', zone, 'down')).toBe('e')
    expect(resolveNextItemId(items, 'e', zone, 'up')).toBe('b')
    expect(resolveNextItemId(items, 'c', zone, 'right')).toBeNull()
  })

  it('normalizes alternate Android TV directional keys', () => {
    expect(normalizeTvRemoteKey({ key: 'Left', code: '', keyCode: 0 })).toBe('left')
    expect(normalizeTvRemoteKey({ key: 'Right', code: '', keyCode: 0 })).toBe('right')
    expect(normalizeTvRemoteKey({ key: 'Up', code: '', keyCode: 0 })).toBe('up')
    expect(normalizeTvRemoteKey({ key: 'Down', code: '', keyCode: 0 })).toBe('down')
  })

  it('falls back to Android TV key codes for d-pad, activate, and back', () => {
    expect(normalizeTvRemoteKey({ key: 'Unidentified', code: '', keyCode: 21 })).toBe('left')
    expect(normalizeTvRemoteKey({ key: 'Unidentified', code: '', keyCode: 22 })).toBe('right')
    expect(normalizeTvRemoteKey({ key: 'Unidentified', code: '', keyCode: 19 })).toBe('up')
    expect(normalizeTvRemoteKey({ key: 'Unidentified', code: '', keyCode: 20 })).toBe('down')
    expect(normalizeTvRemoteKey({ key: 'Unidentified', code: '', keyCode: 23 })).toBe('activate')
    expect(normalizeTvRemoteKey({ key: 'Unidentified', code: '', keyCode: 4 })).toBe('back')
  })

  it('resolves fallback focus order for screens without explicit tv zones', () => {
    expect(resolveFallbackFocusIndex(4, -1, 'down')).toBe(0)
    expect(resolveFallbackFocusIndex(4, -1, 'up')).toBe(3)
    expect(resolveFallbackFocusIndex(4, 1, 'down')).toBe(2)
    expect(resolveFallbackFocusIndex(4, 1, 'up')).toBe(0)
    expect(resolveFallbackFocusIndex(4, 0, 'up')).toBe(0)
    expect(resolveFallbackFocusIndex(4, 3, 'down')).toBe(3)
    expect(resolveFallbackFocusIndex(0, -1, 'down')).toBe(-1)
  })
})
