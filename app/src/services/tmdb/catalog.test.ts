import { describe, expect, it, vi } from 'vitest'
import { buildCatalogParameters } from './browse-utils'

describe('buildCatalogParameters', () => {
  it('applies genre filters to new-release browse requests', async () => {
    const tmdbClient = {
      primaryTranslations: vi.fn().mockResolvedValue([]),
      languages: vi.fn().mockResolvedValue([]),
    } as any

    const parameters = await buildCatalogParameters(
      tmdbClient,
      'movie',
      'en-US',
      1,
      'tmdb.new',
      'Action',
      [{ id: 28, name: 'Action' }],
      {},
    )

    expect(parameters.with_genres).toBe(28)
    expect(parameters.sort_by).toBe('release_date.desc')
    expect(parameters['primary_release_date.gte']).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
