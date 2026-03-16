import { describe, expect, it } from 'vitest'
import { buildSearchQueryVariants, normalizeSearchText, scoreSearchMatch } from './search'

describe('search utils', () => {
  it('normalizes punctuation-heavy titles', () => {
    expect(normalizeSearchText('WALL\u00b7E')).toBe('wall e')
    expect(normalizeSearchText("Schindler's List")).toBe('schindlers list')
    expect(normalizeSearchText('Spider-Man: Into the Spider-Verse')).toBe('spider man into the spider verse')
  })

  it('builds fallback variants for punctuation and spacing', () => {
    expect(buildSearchQueryVariants('wall-e')).toEqual([
      'wall-e',
      'wall e',
      'walle',
      'wall\u00b7e',
    ])

    expect(buildSearchQueryVariants('WALL\u00b7E')).toEqual([
      'WALL\u00b7E',
      'wall e',
      'walle',
      'wall-e',
      'wall\u00b7e',
    ])
  })

  it('builds spelling variants for connectors and numbering', () => {
    expect(buildSearchQueryVariants('mr and mrs smith')).toContain('mr & mrs smith')
    expect(buildSearchQueryVariants('rocky 2')).toContain('rocky ii')
    expect(buildSearchQueryVariants("ocean's eleven")).toContain('oceans 11')
  })

  it('scores equivalent variants as strong matches', () => {
    expect(scoreSearchMatch('WALL\u00b7E', 'wall-e')).toBeGreaterThan(900)
    expect(scoreSearchMatch('WALL\u00b7E', 'walle')).toBeGreaterThan(900)
    expect(scoreSearchMatch('Rocky II', 'rocky 2')).toBeGreaterThan(900)
    expect(scoreSearchMatch('The Flash', 'flash')).toBeGreaterThan(900)
    expect(scoreSearchMatch('Mr. & Mrs. Smith', 'mr and mrs smith')).toBeGreaterThan(900)
    expect(scoreSearchMatch("Ocean's 11", 'oceans eleven')).toBeGreaterThan(900)
    expect(scoreSearchMatch('The Matrix', 'matrix')).toBeGreaterThan(0)
  })
})
