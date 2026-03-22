import { describe, expect, it } from 'vitest'
import {
  catalogSupportsBrowseGenre,
  genreMatchesBrowseFilter,
  isLanguageBrowseCatalog,
  isLanguageBrowseOption,
  itemMatchesBrowseGenre,
  normalizeBrowseGenreOption,
} from './genre-utils'

describe('genre-utils', () => {
  it('normalizes browse labels for shared movie and series filters', () => {
    expect(normalizeBrowseGenreOption('Action & Adventure')).toBe('Action')
    expect(normalizeBrowseGenreOption('Sci-Fi & Fantasy')).toBe('Science Fiction')
    expect(normalizeBrowseGenreOption('Drama')).toBe('Drama')
  })

  it('matches browse filters against TV-style genre aliases', () => {
    expect(genreMatchesBrowseFilter('Action & Adventure', 'Action')).toBe(true)
    expect(genreMatchesBrowseFilter('Sci-Fi & Fantasy', 'Science Fiction')).toBe(true)
    expect(genreMatchesBrowseFilter('War & Politics', 'War')).toBe(true)
    expect(genreMatchesBrowseFilter('Drama', 'Action')).toBe(false)
  })

  it('detects language catalogs and language-style browse options', () => {
    expect(isLanguageBrowseCatalog({ id: 'tmdb.language', name: 'Language' } as any)).toBe(true)
    expect(isLanguageBrowseCatalog({ id: 'popular', name: 'Popular' } as any)).toBe(false)
    expect(isLanguageBrowseOption('English')).toBe(true)
    expect(isLanguageBrowseOption('Español')).toBe(true)
    expect(isLanguageBrowseOption('Drama')).toBe(false)
  })

  it('treats required-extra catalogs as incompatible with generic genre browse', () => {
    expect(catalogSupportsBrowseGenre({ extra: [{ name: 'genre', options: ['Action & Adventure'] }] }, 'Action')).toBe(true)
    expect(
      catalogSupportsBrowseGenre({ extra: [{ name: 'genre', isRequired: true, options: ['Action & Adventure'] }] }, 'Action'),
    ).toBe(false)
  })

  it('filters catalog items by either genre or genres metadata when present', () => {
    expect(itemMatchesBrowseGenre({ id: '1', type: 'movie', name: 'A', genre: ['Action & Adventure'] } as any, 'Action')).toBe(true)
    expect(itemMatchesBrowseGenre({ id: '2', type: 'movie', name: 'B', genres: ['Drama'] } as any, 'Action')).toBe(false)
    expect(itemMatchesBrowseGenre({ id: '3', type: 'movie', name: 'C' }, 'Action')).toBe(true)
  })
})
