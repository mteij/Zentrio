import { Layout } from '../../components/Layout'
import { Navbar } from '../../components/Navbar'
import { LibraryItem } from '../../services/database'

interface StreamingLibraryProps {
  items: LibraryItem[]
  profileId: number
  profile?: any
}

export const StreamingLibrary = ({ items, profileId, profile }: StreamingLibraryProps) => {
  return (
    <Layout title="My List" additionalCSS={['/static/css/streaming.css']}>
      <Navbar profileId={profileId} activePage="library" profile={profile} />
      <div className="streaming-layout">
        <div className="content-container" style={{ paddingTop: '120px', marginTop: 0 }}>
          <h1 style={{ padding: '0 60px', marginBottom: '30px', fontSize: '2.5rem', fontWeight: '800', color: '#fff' }}>My List</h1>
          {items.length === 0 ? (
            <div className="loading" style={{ padding: '40px', textAlign: 'center', color: '#666' }}>Your list is empty.</div>
          ) : (
            <div className="media-grid">
              {items.map(item => (
                <a key={item.meta_id} href={`/streaming/${profileId}/${item.type}/${item.meta_id}`} className="media-card">
                  <div className="poster-container">
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