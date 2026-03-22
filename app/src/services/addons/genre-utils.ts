import type { Catalog, MetaPreview } from './types'

const BROWSE_GENRE_LABEL_MAP: Record<string, string> = {
  'Action & Adventure': 'Action',
  'Sci-Fi & Fantasy': 'Science Fiction',
  'War & Politics': 'War',
}

const BROWSE_GENRE_ALIASES: Record<string, string[]> = {
  action: ['action & adventure'],
  adventure: ['action & adventure'],
  'action & adventure': ['action', 'adventure'],
  'science fiction': ['sci-fi & fantasy'],
  fantasy: ['sci-fi & fantasy'],
  'sci-fi & fantasy': ['science fiction', 'fantasy'],
  war: ['war & politics'],
  'war & politics': ['war'],
}

const LANGUAGE_CATALOG_HINTS = new Set([
  'language',
  'languages',
  'original language',
  'spoken language',
  'spoken languages',
])

const LANGUAGE_BROWSE_OPTIONS = new Set([
  'arabic',
  'bengali',
  'bulgarian',
  'cantonese',
  'chinese',
  'croatian',
  'czech',
  'danish',
  'dutch',
  'english',
  'estonian',
  'filipino',
  'finnish',
  'french',
  'german',
  'greek',
  'gujarati',
  'hebrew',
  'hindi',
  'hungarian',
  'icelandic',
  'indonesian',
  'italian',
  'japanese',
  'kannada',
  'korean',
  'latvian',
  'lithuanian',
  'malay',
  'malayalam',
  'mandarin',
  'marathi',
  'norwegian',
  'persian',
  'polish',
  'portuguese',
  'punjabi',
  'romanian',
  'russian',
  'serbian',
  'slovak',
  'slovenian',
  'spanish',
  'swedish',
  'tamil',
  'telugu',
  'thai',
  'turkish',
  'ukrainian',
  'urdu',
  'vietnamese',
  'espanol',
  'español',
  'castellano',
])

function normalizeGenreKey(value: string): string {
  return value.trim().toLowerCase()
}

function normalizeBrowseOptionKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

function getComparableGenreKeys(value: string): Set<string> {
  const keys = new Set<string>()
  const rawKey = normalizeGenreKey(value)
  if (!rawKey) return keys

  keys.add(rawKey)

  const normalizedLabel = normalizeBrowseGenreOption(value)
  if (normalizedLabel && normalizedLabel !== value) {
    keys.add(normalizeGenreKey(normalizedLabel))
  }

  for (const alias of BROWSE_GENRE_ALIASES[rawKey] || []) {
    keys.add(normalizeGenreKey(alias))
  }

  return keys
}

function extractItemGenres(item: MetaPreview): string[] {
  const raw = item as MetaPreview & { genre?: unknown; genres?: unknown }
  const values = [raw.genre, raw.genres]
  const genres: string[] = []

  for (const value of values) {
    if (Array.isArray(value)) {
      genres.push(...value.filter((entry): entry is string => typeof entry === 'string'))
      continue
    }

    if (typeof value === 'string') {
      genres.push(value)
    }
  }

  return genres
}

export function normalizeBrowseGenreOption(genre: string): string {
  return BROWSE_GENRE_LABEL_MAP[genre] || genre
}

export function isLanguageBrowseCatalog(catalog: Pick<Catalog, 'id' | 'name'>): boolean {
  const candidates = [catalog.id, catalog.name].filter((value): value is string => Boolean(value))
  return candidates.some((candidate) => {
    const normalized = normalizeBrowseOptionKey(candidate).replace(/[._-]+/g, ' ')
    return Array.from(LANGUAGE_CATALOG_HINTS).some((hint) => normalized.includes(hint))
  })
}

export function isLanguageBrowseOption(option: string): boolean {
  const normalized = normalizeBrowseOptionKey(option)
  return LANGUAGE_BROWSE_OPTIONS.has(normalized)
}

export function genreMatchesBrowseFilter(candidateGenre: string, requestedGenre: string): boolean {
  const candidateKeys = getComparableGenreKeys(candidateGenre)
  const requestedKeys = getComparableGenreKeys(requestedGenre)

  for (const key of candidateKeys) {
    if (requestedKeys.has(key)) return true
  }

  return false
}

export function catalogSupportsBrowseGenre(
  catalog: Pick<Catalog, 'extra'>,
  requestedGenre: string,
): boolean {
  const genreExtra = catalog.extra?.find((extra) => extra.name === 'genre')
  if (!genreExtra || genreExtra.isRequired) return false
  if (!genreExtra.options || genreExtra.options.length === 0) return true

  return genreExtra.options.some((option) => genreMatchesBrowseFilter(option, requestedGenre))
}

export function itemMatchesBrowseGenre(item: MetaPreview, requestedGenre: string): boolean {
  const itemGenres = extractItemGenres(item)
  if (itemGenres.length === 0) return true

  return itemGenres.some((genre) => genreMatchesBrowseFilter(genre, requestedGenre))
}
