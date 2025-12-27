import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '../../lib/apiFetch'
import { StreamingRow } from '../index'

interface TraktRecommendation {
  id: string
  type: 'movie' | 'series'
  name: string
  year?: number
  imdb_id?: string
  tmdb_id?: number
  poster?: string
  background?: string
  imdbRating?: string
  description?: string
  ageRating?: string
}

interface TraktRecommendationsRowProps {
  profileId: string | number
  type: 'movies' | 'shows'
  title?: string
  showImdbRatings?: boolean
  showAgeRatings?: boolean
}

export const TraktRecommendationsRow = ({
  profileId,
  type,
  title,
  showImdbRatings = true,
  showAgeRatings = true
}: TraktRecommendationsRowProps) => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['trakt-recommendations', profileId, type],
    queryFn: async () => {
      const res = await apiFetch(`/api/trakt/recommendations?profileId=${profileId}&type=${type}&limit=20`)
      const json = await res.json()
      return json.data as { items: TraktRecommendation[]; connected: boolean }
    },
    staleTime: 1000 * 60 * 10, // 10 minutes
    refetchOnWindowFocus: false
  })

  // Don't render if not connected or no items
  if (!data?.connected || !data?.items?.length) {
    return null
  }

  // Transform recommendations to StreamingRow format
  const items = data.items.map(rec => ({
    id: rec.imdb_id || rec.id,
    type: rec.type === 'movie' ? 'movie' : 'series' as const,
    name: rec.name,
    releaseInfo: rec.year?.toString(),
    poster: rec.poster,
    imdbRating: rec.imdbRating,
    description: rec.description,
    background: rec.background,
    ageRating: rec.ageRating,
  }))

  const defaultTitle = type === 'movies' 
    ? '🎬 Recommended Movies for You' 
    : '📺 Recommended Shows for You'

  return (
    <StreamingRow
      title={title || defaultTitle}
      items={items}
      showImdbRatings={showImdbRatings}
      showAgeRatings={showAgeRatings}
      profileId={profileId.toString()}
    />
  )
}

export default TraktRecommendationsRow
