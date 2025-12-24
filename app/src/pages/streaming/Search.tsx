import { useState, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { Search, Loader2, Filter, ArrowUpDown } from 'lucide-react'
import { Layout, Navbar, RatingBadge, LazyImage, AnimatedBackground } from '../../components'
import { MetaPreview } from '../../services/addons/types'
import styles from '../../styles/Streaming.module.css'

export const StreamingSearch = () => {
  const { profileId } = useParams<{ profileId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const [results, setResults] = useState<MetaPreview[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  const query = searchParams.get('q') || ''
  const typeParam = searchParams.get('type') || 'all'
  const sortParam = searchParams.get('sort') || 'relevance'

  useEffect(() => {
    if (!profileId) {
      navigate('/profiles')
      return
    }
    if (query) {
      performSearch(query, typeParam, sortParam)
    } else {
      setResults([])
    }
  }, [profileId, query, typeParam, sortParam])

  const performSearch = async (q: string, type: string, sort: string) => {
    setLoading(true)
    setError('')
    try {
      let url = `/api/streaming/search?profileId=${profileId}&q=${encodeURIComponent(q)}`
      if (type && type !== 'all') url += `&type=${type}`
      if (sort && sort !== 'relevance') url += `&sort=${sort}`
      
      const res = await fetch(url)
      const data = await res.json()
      setResults(data.results || [])
    } catch (err) {
      console.error(err)
      setError('Failed to search')
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const formData = new FormData(e.target as HTMLFormElement)
    const q = formData.get('q') as string
    if (q) {
      setSearchParams({ q, type: typeParam, sort: sortParam })
    }
  }

  const handleFilterChange = (key: string, value: string) => {
      const newParams = new URLSearchParams(searchParams)
      if (value && value !== 'all' && value !== 'relevance') {
          newParams.set(key, value)
      } else {
          newParams.delete(key)
      }
      setSearchParams(newParams)
  }

  const showImdbRatings = true // Default

  // Determine background image from first result
  const heroImage = results.length > 0 ? (results[0].background || results[0].poster) : undefined;

  return (
    <Layout title="Search" showHeader={false} showFooter={false}>
      <AnimatedBackground 
        image={heroImage} 
        fallbackColor="#000"
        opacity={0.4}
        key={heroImage || 'no-hero'} 
      />
      <div className={`${styles.streamingLayout} ${styles.searchLayout}`}>
        <div className={styles.searchHeader} style={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(20px)',
          padding: '16px 60px',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          gap: '12px',
          width: '100%'
        }}>
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50 pointer-events-none" />
            <form onSubmit={handleSearch} id="searchForm" className="w-full">
              <input
                type="text"
                name="q"
                id="searchInput"
                placeholder="Search..."
                defaultValue={query}
                autoFocus
                className="w-full bg-white/10 border border-white/20 rounded-lg py-2 pl-10 pr-4 text-sm text-white focus:outline-none focus:bg-white/20 transition-colors placeholder:text-white/30"
                autoComplete="off"
              />
            </form>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
                <select 
                    value={typeParam}
                    onChange={(e) => handleFilterChange('type', e.target.value)}
                    className="appearance-none bg-white/10 border border-white/20 rounded-lg px-4 py-2 pr-8 text-sm text-white focus:outline-none focus:bg-white/20 transition-colors cursor-pointer hover:bg-white/20"
                >
                    <option value="all" className="bg-gray-900">All Types</option>
                    <option value="movie" className="bg-gray-900">Movies</option>
                    <option value="series" className="bg-gray-900">Series</option>
                </select>
                <Filter size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 pointer-events-none" />
            </div>

            <div className="relative">
                <select 
                    value={sortParam}
                    onChange={(e) => handleFilterChange('sort', e.target.value)}
                    className="appearance-none bg-white/10 border border-white/20 rounded-lg px-4 py-2 pr-8 text-sm text-white focus:outline-none focus:bg-white/20 transition-colors cursor-pointer hover:bg-white/20"
                >
                    <option value="relevance" className="bg-gray-900">Relevance</option>
                    <option value="newest" className="bg-gray-900">Newest</option>
                    <option value="oldest" className="bg-gray-900">Oldest</option>
                    <option value="rating" className="bg-gray-900">Rating</option>
                </select>
                <ArrowUpDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 pointer-events-none" />
            </div>
          </div>
        </div>

        {query && (
          <div className={styles.contentContainer} style={{ marginTop: 0 }}>
            {results.length > 0 && <h1 style={{ padding: '0 60px', marginBottom: '30px', marginTop: '30px', fontSize: '1.5rem', fontWeight: '600', color: '#fff' }}>Results for "{query}"</h1>}
            
            {loading ? (
                <div className="flex justify-center p-10">
                    <Loader2 className="animate-spin" size={40} />
                </div>
            ) : results.length === 0 ? (
                <div style={{ padding: '60px', color: '#aaa', fontSize: '1.2rem' }}>No results found for "{query}".</div>
            ) : (
                <div className={styles.mediaGrid}>
                    {results.map(item => (
                        <a key={item.id} href={`/streaming/${profileId}/${item.type}/${item.id}`} className={styles.mediaCard}>
                            <div className={styles.posterContainer}>
                                {item.poster ? (
                                    <LazyImage src={item.poster} alt={item.name} className={styles.posterImage} />
                                ) : (
                                    <div className="flex items-center justify-center bg-gray-800 text-gray-400 w-full h-full p-2 text-center text-sm">{item.name}</div>
                                )}
                                {showImdbRatings && item.imdbRating && (
                                    <RatingBadge rating={parseFloat(item.imdbRating)} />
                                )}
                                <div className={styles.cardOverlay}>
                                    <div className={styles.cardTitle}>{item.name}</div>
                                </div>
                            </div>
                        </a>
                    ))}
                </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  )
}