import { describe, expect, it } from 'vitest'
import { resolveTrendingTimeWindow } from './browse-utils'

describe('resolveTrendingTimeWindow', () => {
  it('defaults unsupported browse values back to day', () => {
    expect(resolveTrendingTimeWindow('Action')).toBe('day')
    expect(resolveTrendingTimeWindow('')).toBe('day')
    expect(resolveTrendingTimeWindow('week')).toBe('week')
  })
})
