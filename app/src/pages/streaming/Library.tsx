import { Layout } from '../../components/Layout'
import { Navbar } from '../../components/Navbar'
import { List, ListItem } from '../../services/database'

interface StreamingLibraryProps {
  lists: List[]
  activeList: List
  items: ListItem[]
  profileId: number
  profile?: any
}

export const StreamingLibrary = ({ lists, activeList, items, profileId, profile }: StreamingLibraryProps) => {
  return (
    <Layout title={activeList.name} additionalCSS={['/static/css/streaming.css']} additionalJS={['/static/js/streaming-ui.js']} showHeader={false} showFooter={false}>
      <Navbar profileId={profileId} activePage="library" profile={profile} />
      <div className="streaming-layout">
        <div className="content-container" style={{ paddingTop: '120px', marginTop: 0 }}>
          <div style={{ padding: '0 60px', marginBottom: '30px', display: 'flex', alignItems: 'center', gap: '20px' }}>
            <h1 style={{ fontSize: '2.5rem', fontWeight: '800', color: '#fff', margin: 0 }}>{activeList.name}</h1>
            <div className="list-selector" style={{ position: 'relative' }}>
              <select
                onchange="window.location.href = this.value"
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
                    value={`/streaming/${profileId}/library/${list.id}`}
                    selected={list.id === activeList.id}
                    style={{ background: '#1a1a1a', color: '#fff' }}
                  >
                    {list.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {items.length === 0 ? (
            <div className="loading" style={{ padding: '40px', textAlign: 'center', color: '#666' }}>This list is empty.</div>
          ) : (
            <div className="media-grid">
              {items.map(item => (
                <a key={item.meta_id} href={`/streaming/${profileId}/${item.type}/${item.meta_id}`} className="media-card">
                  <div className="poster-container">
                    {item.imdb_rating && (
                      <div className="imdb-rating-badge">
                        <span className="iconify" data-icon="lucide:star" data-width="10" data-height="10"></span>
                        {item.imdb_rating}
                      </div>
                    )}
                    {item.imdb_rating && (
                      <div className="imdb-rating-badge">
                        <span className="iconify" data-icon="lucide:star" data-width="10" data-height="10"></span>
                        {item.imdb_rating}
                      </div>
                    )}
                    {item.poster ? (
                      <img src={item.poster} alt={item.title} className="poster-image" loading="lazy" />
                    ) : (
                      <div className="no-poster">{item.title}</div>
                    )}
                    <div className="card-overlay">
                      <div className="card-title">{item.title}</div>
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