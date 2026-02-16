import { useState, useEffect, useRef, useLayoutEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { Search, Loader2 } from 'lucide-react'
import { Layout, AnimatedBackground } from '../../components'
import { MetaPreview } from '../../services/addons/types'
import { SearchCatalogRow } from '../../components/features/SearchCatalogRow'
import styles from '../../styles/Streaming.module.css'

interface CatalogSearchResult {
  addon: { id: string; name: string; logo?: string }
  catalog: { type: string; id: string; name?: string }
  items: MetaPreview[]
}

export const StreamingSearch = () => {
  const { profileId } = useParams<{ profileId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const [catalogResults, setCatalogResults] = useState<CatalogSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const hasAutoFocused = useRef(false)
  
  const query = searchParams.get('q') || ''
  const typeParam = searchParams.get('type') || 'all'
  const fromOverlay = searchParams.get('from') === 'overlay'
  
  // Local input state for controlled input
  const [inputValue, setInputValue] = useState(query)
  
  // Track if we should maintain focus after URL changes
  const shouldMaintainFocus = useRef(false)
  
  // Immediately focus input with cursor at end when coming from overlay
  useLayoutEffect(() => {
    if (inputRef.current && !hasAutoFocused.current) {
      hasAutoFocused.current = true
      shouldMaintainFocus.current = true
      inputRef.current.focus()
      // Move cursor to end of text
      const len = inputRef.current.value.length
      inputRef.current.setSelectionRange(len, len)
    }
  }, [])
  
  // Clean up the 'from' param separately to avoid focus issues
  useEffect(() => {
    if (fromOverlay) {
      const newParams = new URLSearchParams(searchParams)
      newParams.delete('from')
      setSearchParams(newParams, { replace: true })
    }
  }, [fromOverlay, searchParams, setSearchParams])
  
  // Re-apply focus after URL param changes if we're in "maintain focus" mode
  useLayoutEffect(() => {
    if (shouldMaintainFocus.current && inputRef.current) {
      // Use requestAnimationFrame to ensure DOM is settled
      requestAnimationFrame(() => {
        if (inputRef.current && document.activeElement !== inputRef.current) {
          inputRef.current.focus()
          const len = inputRef.current.value.length
          inputRef.current.setSelectionRange(len, len)
        }
      })
    }
  }, [searchParams])
  
  // Sync inputValue with URL query on external changes
  useEffect(() => {
    setInputValue(query)
  }, [query])

  // Ref to track the latest search request and cancel stale ones
  const abortControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!profileId) {
      navigate('/profiles')
      return
    }
    if (query) {
      performSearch(query, typeParam)
    } else {
      setCatalogResults([])
    }
  }, [profileId, query, typeParam])
  
  // Debounce effect: update URL after 300ms of no typing
  useEffect(() => {
    // Don't debounce if input matches current query (prevents loops)
    if (inputValue === query) return
    
    const timer = setTimeout(() => {
      if (inputValue.trim()) {
        const newParams = new URLSearchParams(searchParams)
        newParams.set('q', inputValue)
        setSearchParams(newParams, { replace: true })
      } else if (query) {
        // Clear query if input is empty
        const newParams = new URLSearchParams(searchParams)
        newParams.delete('q')
        setSearchParams(newParams, { replace: true })
      }
    }, 300)
    
    return () => clearTimeout(timer)
  }, [inputValue, query, searchParams, setSearchParams])

  const performSearch = async (q: string, type: string) => {
    // Cancel any previous in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    
    // Create new abort controller for this request
    const controller = new AbortController()
    abortControllerRef.current = controller

    setLoading(true)
    setError('')
    try {
      let url = `/api/streaming/search-catalogs?profileId=${profileId}&q=${encodeURIComponent(q)}`
      if (type && type !== 'all') url += `&type=${type}`
      
      const res = await fetch(url, { signal: controller.signal })
      const data = await res.json()
      
      // Only update state if this request wasn't aborted
      if (!controller.signal.aborted) {
        setCatalogResults(data.catalogs || [])
      }
    } catch (err) {
      // Ignore abort errors
      if (err instanceof Error && err.name === 'AbortError') {
        return
      }
      console.error(err)
      setError('Failed to search')
    } finally {
      // Only set loading false if this request wasn't aborted
      // (aborted means a newer request took over)
      if (!controller.signal.aborted) {
        setLoading(false)
      }
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    // Immediately update URL on Enter (skip debounce)
    if (inputValue.trim()) {
      const newParams = new URLSearchParams(searchParams)
      newParams.set('q', inputValue)
      setSearchParams(newParams, { replace: true })
    }
  }

  const handleFilterChange = (key: string, value: string) => {
      const newParams = new URLSearchParams(searchParams)
      if (value && value !== 'all') {
          newParams.set(key, value)
      } else {
          newParams.delete(key)
      }
      setSearchParams(newParams)
  }

  // Determine background image from first result of first catalog
  const heroImage = catalogResults.length > 0 && catalogResults[0].items.length > 0 
    ? (catalogResults[0].items[0].background || catalogResults[0].items[0].poster) 
    : undefined;

  return (
    <Layout title="Search" showHeader={false} showFooter={false}>
      <AnimatedBackground 
        image={heroImage} 
        fallbackColor="#000"
        opacity={0.4}
        key={heroImage || 'no-hero'} 
      />
      <div className={`${styles.streamingLayout} ${styles.searchLayout}`}>
        {/* Search Header - Matches Explore page styling */}
        <div className={styles.exploreHeader}>
          {/* Search Input with glassmorphic styling */}
          <div className={styles.exploreToggleGroup} style={{ padding: '6px', minWidth: '320px', maxWidth: '480px', flex: 1, display: 'flex', alignItems: 'center' }}>
            <Search 
              size={18} 
              style={{
                marginLeft: '12px',
                color: 'rgba(255,255,255,0.5)',
                flexShrink: 0
              }} 
            />
            <form onSubmit={handleSearch} id="searchForm" style={{ flex: 1 }}>
              <input
                ref={inputRef}
                type="text"
                name="q"
                id="searchInput"
                placeholder="Search..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                autoComplete="off"
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  padding: '8px 12px',
                  fontSize: '0.95rem',
                  color: '#fff',
                  outline: 'none'
                }}
              />
            </form>
          </div>

          {/* Right side: Type toggles */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Type Filter - Same as Explore toggles */}
            <div className={styles.exploreToggleGroup}>
              {(['all', 'movie', 'series'] as const).map(type => (
                <button
                  key={type}
                  onClick={() => handleFilterChange('type', type)}
                  className={`${styles.exploreToggleBtn} ${typeParam === type ? styles.exploreToggleBtnActive : ''}`}
                >
                  {type === 'all' ? 'All' : type === 'movie' ? 'Movies' : 'Series'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className={`${styles.contentContainer} ${styles.contentOffset}`}>
          {query && catalogResults.length > 0 && (
            <h1 style={{ 
              padding: '0 60px', 
              marginBottom: '30px', 
              fontSize: '1.5rem', 
              fontWeight: '600', 
              color: '#fff'
            }}>
              Results for "{query}"
            </h1>
          )}
          
          {loading ? (
              <div className="flex justify-center p-10">
                  <Loader2 className="animate-spin" size={40} />
              </div>
          ) : !query ? (
              <div style={{ padding: '60px', color: '#aaa', fontSize: '1.2rem', textAlign: 'center' }}>
                Start typing to search for movies and series...
              </div>
          ) : catalogResults.length === 0 ? (
              <div style={{ padding: '60px', color: '#aaa', fontSize: '1.2rem' }}>No results found for "{query}".</div>
          ) : (
              <div className={styles.catalogRows}>
                {catalogResults.map((result) => (
                  <SearchCatalogRow
                    key={`${result.addon.id}-${result.catalog.id}`}
                    addon={result.addon}
                    catalog={result.catalog}
                    items={result.items}
                    profileId={profileId!}
                  />
                ))}
              </div>
          )}
        </div>
      </div>
    </Layout>
  )
}