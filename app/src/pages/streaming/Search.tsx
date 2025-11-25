import { Layout } from '../../components/Layout'
import { Navbar } from '../../components/Navbar'
import { MetaPreview } from '../../services/addons/types'

interface StreamingSearchProps {
  results: MetaPreview[]
  query: string
  profileId: number
}

export const StreamingSearch = ({ results, query, profileId }: StreamingSearchProps) => {
  return (
    <Layout title="Search" additionalCSS={['/static/css/streaming.css']}>
      <Navbar profileId={profileId} activePage="search" />
      <div className="streaming-layout">
        <div className="search-header">
          <div className="search-input-wrapper">
            <i data-lucide="search" className="search-icon" style={{ width: 20, height: 20 }}></i>
            <form action={`/streaming/${profileId}/search`} method="get">
              <input
                type="text"
                name="q"
                placeholder="Search movies & series..."
                defaultValue={query}
                autoFocus
                className="search-input-glass"
              />
            </form>
          </div>
        </div>

        {query && (
          <div className="content-container">
            <h1 style={{ padding: '0 40px', marginBottom: '30px', fontSize: '2rem', fontWeight: '600' }}>Results for "{query}"</h1>
            {results.length === 0 ? (
              <div className="loading" style={{ padding: '40px', textAlign: 'center' }}>No results found.</div>
            ) : (
              <div className="media-grid">
                {results.map(item => (
                  <a key={item.id} href={`/streaming/${profileId}/${item.type}/${item.id}`} className="media-card">
                    <div className="poster-container">
                      {item.poster ? (
                        <img src={item.poster} alt={item.name} className="poster-image" loading="lazy" />
                      ) : (
                        <div className="no-poster">{item.name}</div>
                      )}
                      <div className="card-overlay">
                        <div className="card-title">{item.name}</div>
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