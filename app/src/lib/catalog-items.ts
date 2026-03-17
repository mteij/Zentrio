import type { MetaPreview } from '../services/addons/types'
import { getAddonClient, ZENTRIO_TMDB_ADDON } from './addon-client'
import { apiFetchJson } from './apiFetch'
import { filterAndEnrichItems } from './filter-enrich'

export async function fetchCatalogItems(
  profileId: string,
  manifestUrl: string,
  type: string,
  id: string,
): Promise<MetaPreview[]> {
  let items: MetaPreview[]

  if (manifestUrl === ZENTRIO_TMDB_ADDON || manifestUrl.startsWith('zentrio://')) {
    const data = await apiFetchJson<{ metas: MetaPreview[] }>(
      `/api/tmdb/catalog/${type}/${id}?profileId=${profileId}`,
    )
    items = data.metas || []
  } else {
    const client = getAddonClient(manifestUrl)
    items = await client.getCatalog(type, id)
  }

  if (items.length > 0) {
    try {
      return await filterAndEnrichItems(items, profileId)
    } catch {
      return items
    }
  }

  return items
}
