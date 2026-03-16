import { MetaPreview } from '../services/addons/types'
import { apiFetchJson } from './apiFetch'

type CompactMetaPreview = Pick<MetaPreview, 'id' | 'type' | 'name' | 'releaseInfo' | 'ageRating'> & {
  certification?: string
  rating?: string
  contentRating?: string
  info?: {
    certification?: unknown
    rating?: unknown
  }
}

const getItemKey = (item: { id: string; type: string }) => `${item.type}::${item.id}`

function toCompactMetaPreview(item: MetaPreview): CompactMetaPreview {
  const itemAny = item as unknown as Record<string, unknown>
  const info = itemAny.info as Record<string, unknown> | undefined

  return {
    id: item.id,
    type: item.type,
    name: item.name,
    releaseInfo: item.releaseInfo,
    ageRating: item.ageRating,
    certification: typeof itemAny.certification === 'string' ? itemAny.certification : undefined,
    rating: typeof itemAny.rating === 'string' ? itemAny.rating : undefined,
    contentRating: typeof itemAny.contentRating === 'string' ? itemAny.contentRating : undefined,
    info: info && (info.certification !== undefined || info.rating !== undefined)
      ? {
          certification: info.certification,
          rating: info.rating,
        }
      : undefined,
  }
}

export async function filterAndEnrichItems(items: MetaPreview[], profileId: string): Promise<MetaPreview[]> {
  if (items.length === 0) return items

  const compactItems = items.map(toCompactMetaPreview)
  const result = await apiFetchJson<{ items: Array<Record<string, unknown> & { id: string; type: string }> }>(
    '/api/streaming/filter-enrich',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: compactItems, profileId: parseInt(profileId) }),
    }
  )

  const enrichedItems = result.items || []
  const enrichedByKey = new Map(enrichedItems.map((item) => [getItemKey(item), item]))

  return items
    .filter((item) => enrichedByKey.has(getItemKey(item)))
    .map((item) => ({
      ...item,
      ...enrichedByKey.get(getItemKey(item)),
    }))
}
