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
      <div className="streaming-layout no-hero">
        <div className="search-header" style={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          background: 'rgba(0,0,0,0.8)',
          backdropFilter: 'blur(20px)',
          paddingTop: '40px',
          paddingBottom: '20px',
          borderBottom: '1px solid rgba(255,255,255,0.05)'
        }}>
          <div className="search-input-wrapper">
            <span className="iconify search-icon" data-icon="lucide:search" data-width="20" data-height="20"></span>
            <form action={`/streaming/${profileId}/search`} method="get" id="searchForm">
              <input
                type="text"
                name="q"
                id="searchInput"
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
          <div className="content-container" style={{ marginTop: 0 }} id="searchResultsContainer" data-query={query} data-profile-id={profileId}>
            <h1 style={{ padding: '0 60px', marginBottom: '30px', fontSize: '2rem', fontWeight: '600', color: '#fff' }}>Results for "{query}"</h1>
            <div id="searchResultsGrid" className="media-grid">
                {/* Results will be populated here via JS */}
                <div className="loading-spinner" style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'center', padding: '40px' }}>
                    <span className="iconify" data-icon="lucide:loader-2" data-width="40" data-height="40" style={{ animation: 'spin 1s linear infinite' }}></span>
                </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}