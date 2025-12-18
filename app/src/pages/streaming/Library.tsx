import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Layout, Navbar, RatingBadge, LazyImage, SkeletonCard } from '../../components'
import { List, ListItem } from '../../services/database'
import styles from '../../styles/Streaming.module.css'

export const StreamingLibrary = () => {
  const { profileId, listId } = useParams<{ profileId: string, listId?: string }>()
  const navigate = useNavigate()
  const [lists, setLists] = useState<List[]>([])
  const [activeList, setActiveList] = useState<List | null>(null)
  const [items, setItems] = useState<ListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [profile, setProfile] = useState<any>(null)

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
    loadLibrary()
  }, [profileId, listId])

  const loadLibrary = async () => {
    setLoading(true)
    try {
      // Fetch lists
      const listsRes = await fetch(`/api/lists?profileId=${profileId}`)
      const listsData = await listsRes.json()
      
      if (listsData.lists && listsData.lists.length > 0) {
        setLists(listsData.lists)
        
        let currentList = listsData.lists[0]
        if (listId) {
          const found = listsData.lists.find((l: List) => l.id === parseInt(listId))
          if (found) currentList = found
        }
        
        setActiveList(currentList)
        
        // Fetch items for active list
        const itemsRes = await fetch(`/api/lists/${currentList.id}/items`)
        const itemsData = await itemsRes.json()
        setItems(itemsData.items || [])
      } else {
        // Create default list if none exist
        const createRes = await fetch('/api/lists', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ profileId, name: 'My List' })
        })
        const createData = await createRes.json()
        if (createData.list) {
            setLists([createData.list])
            setActiveList(createData.list)
            setItems([])
        }
      }
    } catch (err) {
      console.error(err)
      setError('Failed to load library')
    } finally {
      setLoading(false)
    }
  }

  const handleListChange = (newListId: string) => {
    navigate(`/streaming/${profileId}/library/${newListId}`)
  }

  if (loading) {
    return (
      <Layout title="Library" showHeader={false} showFooter={false}>
        <Navbar profileId={parseInt(profileId!)} activePage="library" />
        <div className={`${styles.streamingLayout} ${styles.streamingLayoutNoHero}`}>
          <div className={styles.contentContainer} style={{ marginTop: 0 }}>
            <div style={{ padding: '0 60px', marginBottom: '30px', display: 'flex', alignItems: 'center', gap: '20px' }}>
              <div style={{ width: '180px', height: '40px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '8px', position: 'relative', overflow: 'hidden' }}>
                <div className={styles.skeletonShimmer} />
              </div>
            </div>
            <div className={styles.mediaGrid}>
              {Array.from({ length: 12 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          </div>
        </div>
      </Layout>
    )
  }

  if (error) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#141414', color: 'white' }}>
        {error}
      </div>
    )
  }

  const showImdbRatings = true // Default

  return (
    <Layout title={activeList?.name || 'Library'} showHeader={false} showFooter={false}>
      <Navbar profileId={parseInt(profileId!)} activePage="library" profile={profile} />
      <div className={`${styles.streamingLayout} ${styles.streamingLayoutNoHero}`}>
        <div className={styles.contentContainer} style={{ marginTop: 0 }}>
          <div style={{ padding: '0 60px', marginBottom: '30px', display: 'flex', alignItems: 'center', gap: '20px' }}>
            <h1 style={{ fontSize: '2.5rem', fontWeight: '800', color: '#fff', margin: 0 }}>{activeList?.name}</h1>
            <div className="list-selector" style={{ position: 'relative' }}>
              <select
                value={activeList?.id}
                onChange={(e) => handleListChange(e.target.value)}
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: '#fff',
                  padding: '8px 16px',
                  borderRadius: '20px',
                  fontSize: '1rem',
                  cursor: 'pointer',
                  outline: 'none'
                }}
              >
                {lists.map(list => (
                  <option
                    key={list.id}
                    value={list.id}
                    style={{ background: '#1a1a1a', color: '#fff' }}
                  >
                    {list.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {items.length === 0 ? (
            <div className="p-10 text-center text-gray-500">This list is empty.</div>
          ) : (
            <div className={styles.mediaGrid}>
              {items.map(item => (
                <a key={item.meta_id} href={`/streaming/${profileId}/${item.type}/${item.meta_id}`} className={styles.mediaCard}>
                  <div className={styles.posterContainer}>
                    {item.poster ? (
                      <LazyImage src={item.poster || ''} alt={item.title || ''} className={styles.posterImage} />
                    ) : (
                      <div className="flex items-center justify-center bg-gray-800 text-gray-400 w-full h-full p-2 text-center text-sm">{item.title}</div>
                    )}
                    {showImdbRatings && item.imdb_rating && (
                      <RatingBadge rating={item.imdb_rating} />
                    )}
                    <div className={styles.cardOverlay}>
                      <div className={styles.cardTitle}>{item.title}</div>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}