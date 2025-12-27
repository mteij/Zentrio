import { useState, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ChevronDown } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { apiFetch, apiFetchJson } from '../../lib/apiFetch'
import { Layout, StreamingRow, SkeletonRow, Hero, SkeletonHero, LazyImage, RatingBadge, SkeletonCard } from '../../components'
import { TraktRecommendationsRow } from '../../components/streaming/TraktRecommendationsRow'

import { MetaPreview } from '../../services/addons/types'
import { useAppearanceSettings } from '../../hooks/useAppearanceSettings'
import styles from '../../styles/Streaming.module.css'

// -- Internal GenreRow Component --
interface GenreRowProps {
  genre: string
  profileId: string
  showImdbRatings: boolean
  showAgeRatings: boolean
  type?: 'movie' | 'series' | 'all'
}

const GenreRow = ({ genre, profileId, showImdbRatings, showAgeRatings, type }: GenreRowProps) => {
  const { data, isLoading } = useQuery({
    queryKey: ['explore-genre', profileId, genre, type],
    queryFn: async () => {
      // Fetch specifically for this genre
      // We limit to 20 items for the row
      const typeParam = type && type !== 'all' ? type : 'movie,series'
      return apiFetchJson<{ items: MetaPreview[] }>(`/api/streaming/catalog?profileId=${profileId}&type=${typeParam}&genre=${encodeURIComponent(genre)}&skip=0`)
    },
    staleTime: 1000 * 60 * 60 // 1 hour
  })

  if (isLoading) {
    return <SkeletonRow />
  }

  if (!data?.items || data.items.length === 0) {
    return null
  }

  // Update seeAllUrl to include type if specified
  const seeAllBase = `/explore/${profileId}?genre=${encodeURIComponent(genre)}`
  const seeAllUrl = type && type !== 'all' ? `${seeAllBase}&type=${type}` : seeAllBase

  return (
    <StreamingRow
      title={genre}
      items={data.items}
      profileId={profileId}
      showImdbRatings={showImdbRatings}
      showAgeRatings={showAgeRatings}
      seeAllUrl={seeAllUrl}
    />
  )
}

// -- Main Explore Component --
interface ExploreDashboardData {
  trending: MetaPreview[]
  trendingMovies?: MetaPreview[]
  trendingSeries?: MetaPreview[]
  profile: any
}

interface FiltersData {
  filters: { types: string[], genres: string[] }
}

const POPULAR_GENRES = ['Action', 'Adventure', 'Comedy', 'Science Fiction', 'Drama', 'Thriller', 'Animation', 'Fantasy', 'Crime', 'Mystery', 'Romance', 'Horror', 'Family', 'War', 'History']

export const StreamingExplore = () => {
  const { profileId } = useParams<{ profileId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const { showImdbRatings, showAgeRatings } = useAppearanceSettings()

  // State for view toggle
  const [viewMode, setViewMode] = useState<'all' | 'movie' | 'series'>('all')

  // Sticky header state
  const [isSticky, setIsSticky] = useState(false)

  // If a genre is selected via URL, we show the filtered grid view.
  const activeGenre = searchParams.get('genre')
  const activeType = searchParams.get('type')

  const isFilteredView = !!activeGenre || !!activeType

  // Shuffle popular genres on mount to keep it fresh
  const [shuffledGenres, setShuffledGenres] = useState<string[]>([])
  useEffect(() => {
    setShuffledGenres([...POPULAR_GENRES].sort(() => 0.5 - Math.random()))
  }, [])

  // Fetch Dashboard (for Trending/Top 10)
  const { data: dashboardData, isLoading: loadingDash } = useQuery({
    queryKey: ['dashboard', profileId],
    queryFn: async () => {
      return apiFetchJson<ExploreDashboardData>(`/api/streaming/dashboard?profileId=${profileId}`)
    },
    enabled: !isFilteredView
  })

  // Fetch Filters
  const { data: filtersData, isLoading: loadingFilters } = useQuery({
    queryKey: ['filters', profileId],
    queryFn: async () => {
      return apiFetchJson<FiltersData>(`/api/streaming/filters?profileId=${profileId}`)
    }
  })

  // ... (Filtered view logic remains same) ...
  const [filteredItems, setFilteredItems] = useState<MetaPreview[]>([])
  const [loadingFiltered, setLoadingFiltered] = useState(false)
  const [skip, setSkip] = useState(0)
  const [hasMore, setHasMore] = useState(true)

  useEffect(() => {
    if (isFilteredView && profileId) {
      setLoadingFiltered(true)
      setFilteredItems([])
      setSkip(0)
      setHasMore(true)
      
      const fetchFiltered = async () => {
        try {
            const typeParam = activeType || ''
            const genreParam = activeGenre || ''
            const data = await apiFetchJson<{ items: MetaPreview[] }>(`/api/streaming/catalog?profileId=${profileId}&type=${typeParam}&genre=${encodeURIComponent(genreParam)}&skip=0`)
            setFilteredItems(data.items || [])
            setSkip(data.items?.length || 0)
            if ((data.items?.length || 0) < 20) setHasMore(false)
        } catch (e) {
            console.error(e)
        } finally {
            setLoadingFiltered(false)
        }
      }
      fetchFiltered()
    }
  }, [isFilteredView, activeGenre, activeType, profileId])

  const loadMore = async () => {
    if (loadingFiltered || !hasMore || !isFilteredView) return
    const typeParam = activeType || ''
    const genreParam = activeGenre || ''
    try {
        const data = await apiFetchJson<{ items: MetaPreview[] }>(`/api/streaming/catalog?profileId=${profileId}&type=${typeParam}&genre=${encodeURIComponent(genreParam)}&skip=${skip}`)
        if (data.items && data.items.length > 0) {
            setFilteredItems(prev => [...prev, ...data.items])
            setSkip(prev => prev + data.items.length)
            if (data.items.length < 20) setHasMore(false)
        } else {
            setHasMore(false)
        }
    } catch (e) {
        console.error(e)
    }
  }

  // Infinite scroll & Sticky Header detection
  useEffect(() => {
      const handleScroll = () => {
        // Sticky Header: Threshold calculation.
        // Assuming Hero is roughly 85vh and content overlaps by 100px.
        // We want sticky state when header hits top. 
        // Header sits at ~85vh - 100px.
        // We trigger slightly before it hits top. 
        const stickyThreshold = window.innerHeight * 0.75;
        setIsSticky(window.scrollY > stickyThreshold);

        if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 500) {
          loadMore()
        }
      }
      window.addEventListener('scroll', handleScroll)
      return () => window.removeEventListener('scroll', handleScroll)
  }, [loadingFiltered, hasMore, skip, isFilteredView, activeGenre, activeType])


  const updateFilter = (key: string, value: string) => {
    const newParams = new URLSearchParams(searchParams)
    if (value) {
      newParams.set(key, value)
    } else {
      newParams.delete(key)
    }
    setSearchParams(newParams)
  }

  // --- Render ---

  if ((loadingDash && !isFilteredView) || loadingFilters) {
     return (
        <Layout title="Explore" showHeader={false} showFooter={false}>
            <div className={styles.streamingLayout}>
                <SkeletonHero />
                <div className={styles.contentContainer} style={{ marginTop: '-100px' }}>
                    <SkeletonRow />
                    <SkeletonRow />
                </div>
            </div>
        </Layout>
     )
  }

  const genres = filtersData?.filters?.genres || []
  const types = filtersData?.filters?.types || ['movie', 'series']
  
  const trending = dashboardData?.trending || []
  const trendingMovies = dashboardData?.trendingMovies || []
  const trendingSeries = dashboardData?.trendingSeries || []

  // Logic for display genres based on viewMode
  // If ALL: show random mixed genres.
  // If Movie: show random movie genres (technically just random genres that contain movies, usually broad).
  // If Series: show random series genres.
  // We don't strictly filter genres by type in backend here, but we can assume popular genres work for both or use GenreRow to fetch appropriately.
  // GenreRow component calls `type=movie,series` by default. We should let it respect our viewMode!
  
  // We need to modify GenreRow to accept a type override or rely on its own logic.
  // For now let's reuse GenreRow but maybe pass type?
  // The internal GenreRow (lines 11-50) hardcodes `type=movie,series`. 
  // We can't easily change it here without refactoring GenreRow or duplicating it. 
  // Let's refactor GenreRow slightly to accept type prop.
  
  // Wait, I can't refactor GenreRow inside this replacement block easily if it's separate. 
  // GenreRow is lines 18-49. I am replacing lines 51-325. 
  // I will assume GenreRow will be updated separately or I will update it in a separate call if needed.
  // Actually, I can update GenreRow later. For "All", mixed is fine.
  // For "Movie", we want GenreRow to fetch `type=movie`. 
  // For "Series", `type=series`.
  // I will update GenreRow in a follow-up step.
  
  const displayGenres = genres.length > 0 
    ? shuffledGenres.filter(g => genres.includes(g)).concat(genres.filter(g => !shuffledGenres.includes(g)))
    : shuffledGenres
  
  const rowGenres = displayGenres.slice(0, 15)

  const showHero = !isFilteredView && trending.length > 0
  
  return (
    <Layout title="Explore" showHeader={false} showFooter={false}>
        <div className={styles.streamingLayout} style={{ minHeight: '100vh' }}>
            {/* Hero is always based on mixed trending or history - keeps page dynamic */}
            {/* Or should Hero change based on Toggle? User didn't specify, but usually Hero implies "Featured". 
                Let's keep Hero mixed for now as it's the "Main" feature. */}
            {showHero && (
                <Hero 
                    items={trending} 
                    profileId={profileId!} 
                    showTrending={true}
                    storageKey="exploreHeroIndex"
                />
            )}

            <div className={styles.contentContainer} style={{ marginTop: showHero ? undefined : '40px' }}>
                
                {/* Header / View Toggles / Filter Bar */}
                <div 
                    className={`
                        sticky top-[var(--titlebar-height,0px)] z-50 transition-all duration-300
                        flex items-center justify-between mb-8
                        ${isSticky 
                            ? 'bg-black/90 backdrop-blur-xl border-b border-white/10 py-4 shadow-2xl' 
                            : 'bg-transparent py-0'
                        }
                        px-[60px]
                    `}
                >
                     {isFilteredView ? (
                        <div className="flex items-center gap-4">
                            <button 
                                onClick={() => { setSearchParams({}); setViewMode('all'); }}
                                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors backdrop-blur-md border border-white/10"
                                aria-label="Go Back"
                            >
                                <ArrowLeft className="text-white w-5 h-5" />
                            </button>
                            <h1 className="text-3xl font-bold text-white">
                                {activeGenre || (activeType ? (activeType === 'movie' ? 'Movies' : 'Series') : 'Explore')}
                            </h1>
                        </div>
                     ) : (
                         <div className="flex gap-2 p-1 bg-white/10 backdrop-blur-md rounded-full border border-white/10">
                            {(['all', 'movie', 'series'] as const).map(mode => (
                                <button
                                    key={mode}
                                    onClick={() => setViewMode(mode)}
                                    className={`px-6 py-2 rounded-full text-sm font-semibold transition-all duration-300 ${
                                        viewMode === mode 
                                        ? 'bg-white text-black shadow-lg scale-105' 
                                        : 'text-white/70 hover:text-white hover:bg-white/10'
                                    }`}
                                >
                                    {mode === 'all' ? 'All' : mode === 'movie' ? 'Movies' : 'TV Shows'}
                                </button>
                            ))}
                         </div>
                     )}

                     {!isFilteredView && (
                         // Filter Button (Genres)
                         <div className="flex relative">
                             <div className="relative">
                                <select 
                                    className="appearance-none bg-white/10 border border-white/10 text-white pl-6 pr-10 py-2.5 rounded-full backdrop-blur-md focus:outline-none focus:ring-2 focus:ring-white/20 cursor-pointer hover:bg-white/20 transition-all duration-300 text-sm font-semibold text-white/90"
                                    onChange={(e) => updateFilter('genre', e.target.value)}
                                    value=""
                                >
                                    <option value="" disabled>Genres</option>
                                    {genres.map(g => (
                                        <option key={g} value={g} className="text-black bg-white">{g}</option>
                                    ))}
                                </select>
                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50 pointer-events-none" />
                             </div>
                         </div>
                     )}
                </div>

                {isFilteredView ? (
                    // GRID VIEW for Filtered Results
                    <div className={styles.contentRow}>
                         {loadingFiltered ? (
                             <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 px-[60px]">
                                 {[...Array(10)].map((_, i) => <SkeletonCard key={i} />)}
                             </div>
                         ) : filteredItems.length > 0 ? (
                             <div className={styles.mediaGrid}>
                                {filteredItems.map(item => (
                                    <a key={item.id} href={`/streaming/${profileId}/${item.type}/${item.id}`} className={styles.mediaCard}>
                                        <div className={styles.posterContainer}>
                                            <LazyImage src={item.poster || ''} alt={item.name} className={styles.posterImage} />
                                             <div className={styles.badgesContainer}>
                                                {showImdbRatings && item.imdbRating && (
                                                    <RatingBadge rating={parseFloat(item.imdbRating)} />
                                                )}
                                             </div>
                                            <div className={styles.cardOverlay}>
                                                <div className={styles.cardTitle}>{item.name}</div>
                                            </div>
                                        </div>
                                    </a>
                                ))}
                             </div>
                         ) : (
                             <div className="text-center text-gray-500 py-20">No results found.</div>
                         )}
                    </div>
                ) : (
                    // VIEW MODE ROWS
                    <>
                         {/* All Mode: Show Both Movies and Series Top 10 */}
                         {viewMode === 'all' && (
                             <>
                                {trendingMovies.length > 0 && (
                                    <StreamingRow
                                        title="Top 10 Movies Today"
                                        items={trendingMovies}
                                        profileId={profileId!}
                                        showImdbRatings={showImdbRatings}
                                        showAgeRatings={showAgeRatings}
                                        isRanked={true}
                                    />
                                )}
                                {trendingSeries.length > 0 && (
                                    <StreamingRow
                                        title="Top 10 Series Today"
                                        items={trendingSeries}
                                        profileId={profileId!}
                                        showImdbRatings={showImdbRatings}
                                        showAgeRatings={showAgeRatings}
                                        isRanked={true}
                                    />
                                )}
                             </>
                         )}

                        {/* Movie Mode: Show Only Movies Top 10 */}
                         {viewMode === 'movie' && trendingMovies.length > 0 && (
                            <StreamingRow
                                title="Top 10 Movies Today"
                                items={trendingMovies}
                                profileId={profileId!}
                                showImdbRatings={showImdbRatings}
                                showAgeRatings={showAgeRatings}
                                isRanked={true}
                            />
                         )}

                        {/* Series Mode: Show Only Series Top 10 */}
                         {viewMode === 'series' && trendingSeries.length > 0 && (
                            <StreamingRow
                                title="Top 10 Series Today"
                                items={trendingSeries}
                                profileId={profileId!}
                                showImdbRatings={showImdbRatings}
                                showAgeRatings={showAgeRatings}
                                isRanked={true}
                            />
                         )}

                         {/* Trakt Recommendations - only shows if connected */}
                         {viewMode === 'all' && (
                           <>
                             <TraktRecommendationsRow
                               profileId={profileId!}
                               type="movies"
                               showImdbRatings={showImdbRatings}
                               showAgeRatings={showAgeRatings}
                             />
                             <TraktRecommendationsRow
                               profileId={profileId!}
                               type="shows"
                               showImdbRatings={showImdbRatings}
                               showAgeRatings={showAgeRatings}
                             />
                           </>
                         )}
                         {viewMode === 'movie' && (
                           <TraktRecommendationsRow
                             profileId={profileId!}
                             type="movies"
                             showImdbRatings={showImdbRatings}
                             showAgeRatings={showAgeRatings}
                           />
                         )}
                         {viewMode === 'series' && (
                           <TraktRecommendationsRow
                             profileId={profileId!}
                             type="shows"
                             showImdbRatings={showImdbRatings}
                             showAgeRatings={showAgeRatings}
                           />
                         )}

                         {/* Genre Rows - Pass viewMode as type */}
                         {rowGenres.map(genre => (
                             <GenreRow 
                                key={`${genre}-${viewMode}`} 
                                genre={genre} 
                                profileId={profileId!} 
                                showImdbRatings={showImdbRatings}
                                showAgeRatings={showAgeRatings}
                                type={viewMode === 'all' ? undefined : viewMode}
                             />
                         ))}
                    </>
                )}

            </div>
        </div>
    </Layout>
  )
}

