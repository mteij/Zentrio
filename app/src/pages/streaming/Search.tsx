import { useState, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { Search, Loader2 } from 'lucide-react'
import { Layout, Navbar, RatingBadge, LazyImage } from '../../components'
import { MetaPreview } from '../../services/addons/types'
import styles from '../../styles/Streaming.module.css'

export const StreamingSearch = () => {
  const { profileId } = useParams<{ profileId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const [results, setResults] = useState<MetaPreview[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [profile, setProfile] = useState<any>(null)
  
  const query = searchParams.get('q') || ''

  // Fetch profile for navbar avatar
  useEffect(() => {
    if (profileId) {
      fetch(`/api/streaming/dashboard?profileId=${profileId}`)
        .then(res => res.json())
        .then(data => setProfile(data.profile))
        .catch(console.error)
    }
  }, [profileId])

  useEffect(() => {
    if (!profileId) {
      navigate('/profiles')
      return
    }
    if (query) {
      performSearch(query)
    } else {
      setResults([])
    }
  }, [profileId, query])

  const performSearch = async (q: string) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/streaming/search?profileId=${profileId}&q=${encodeURIComponent(q)}`)
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
      setSearchParams({ q })
    }
  }

  const showImdbRatings = true // Default

  return (
    <Layout title="Search" showHeader={false} showFooter={false}>
      <Navbar profileId={parseInt(profileId!)} activePage="search" profile={profile} />
      <div className={`${styles.streamingLayout} ${styles.streamingLayoutNoHero}`}>
        <div className={styles.searchHeader} style={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          background: 'rgba(0,0,0,0.8)',
          backdropFilter: 'blur(20px)',
          paddingTop: '40px',
          paddingBottom: '20px',
          borderBottom: '1px solid rgba(255,255,255,0.05)'
        }}>
          <div className={styles.searchInputWrapper}>
            <Search className={styles.searchIcon} size={20} />
            <form onSubmit={handleSearch} id="searchForm">
              <input
                type="text"
                name="q"
                id="searchInput"
                placeholder="Search movies & series..."
                defaultValue={query}
                autoFocus
                className={styles.searchInputGlass}
                autoComplete="off"
              />
            </form>
          </div>
        </div>

        {query && (
          <div className={styles.contentContainer} style={{ marginTop: 0 }}>
            <h1 style={{ padding: '0 60px', marginBottom: '30px', fontSize: '2rem', fontWeight: '600', color: '#fff' }}>Results for "{query}"</h1>
            
            {loading ? (
                <div className="flex justify-center p-10">
                    <Loader2 className="animate-spin" size={40} />
                </div>
            ) : results.length === 0 ? (
                <div style={{ padding: '0 60px', color: '#aaa' }}>No results found.</div>
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