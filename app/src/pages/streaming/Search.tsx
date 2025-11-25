import { Layout } from '../../components/Layout'
import { Navbar } from '../../components/Navbar'
import { MetaPreview } from '../../services/addons/types'
import { listDb } from '../../services/database'

interface StreamingSearchProps {
  results: MetaPreview[]
  query: string
  profileId: number
  profile?: any
}

export const StreamingSearch = ({ results, query, profileId, profile }: StreamingSearchProps) => {
  return (
    <Layout title="Search" additionalCSS={['/static/css/streaming.css']} additionalJS={['/static/js/streaming-ui.js']} showHeader={false} showFooter={false}>
      <Navbar profileId={profileId} activePage="search" profile={profile} />
      <div className="streaming-layout">
        <div className="search-header" style={{ paddingTop: '120px' }}>
          <div className="search-input-wrapper">
            <span className="iconify search-icon" data-icon="lucide:search" data-width="20" data-height="20"></span>
            <form action={`/streaming/${profileId}/search`} method="get">
              <input
                type="text"
                name="q"
                placeholder="Search movies & series..."
                defaultValue={query}
                autoFocus
                className="search-input-glass"
                autoComplete="off"
              />
            </form>
          </div>
        </div>

        {query && (
          <div className="content-container" style={{ marginTop: 0 }}>
            <h1 style={{ padding: '0 60px', marginBottom: '30px', fontSize: '2rem', fontWeight: '600', color: '#fff' }}>Results for "{query}"</h1>
            {results.length === 0 ? (
              <div className="loading" style={{ padding: '40px', textAlign: 'center', color: '#666' }}>No results found.</div>
            ) : (
              <div className="media-grid">
                {results.map(item => {
                  const inList = listDb.isInAnyList(profileId, item.id);
                  return (
                    <a key={item.id} href={`/streaming/${profileId}/${item.type}/${item.id}`} className="media-card">
                      <div className="poster-container">
                        {item.imdbRating && (
                          <div className="imdb-rating-badge">
                            <span className="iconify" data-icon="lucide:star" data-width="10" data-height="10"></span>
                            {item.imdbRating}
                          </div>
                        )}
                        {item.poster ? (
                          <img src={item.poster} alt={item.name} className="poster-image" loading="lazy" />
                        ) : (
                          <div className="no-poster">{item.name}</div>
                        )}
                        {inList && (
                          <div className="in-list-indicator" style={{
                            position: 'absolute',
                            top: '8px',
                            right: '8px',
                            background: 'rgba(0,0,0,0.7)',
                            borderRadius: '50%',
                            width: '24px',
                            height: '24px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: '1px solid rgba(255,255,255,0.3)'
                          }}>
                            <span className="iconify" data-icon="lucide:check" data-width="14" data-height="14" style={{ color: 'var(--accent)' }}></span>
                          </div>
                        )}
                        <div className="card-overlay">
                          <div className="card-title">{item.name}</div>
                        </div>
                      </div>
                    </a>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  )
}