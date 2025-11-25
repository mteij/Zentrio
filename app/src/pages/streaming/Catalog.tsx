import { Layout } from '../../components/Layout'
import { Navbar } from '../../components/Navbar'
import { MetaPreview } from '../../services/addons/types'

interface StreamingCatalogProps {
  items: MetaPreview[]
  title: string
  profileId: number
  profile?: any
}

export const StreamingCatalog = ({ items, title, profileId, profile }: StreamingCatalogProps) => {
  return (
    <Layout title={title} additionalCSS={['/static/css/streaming.css']}>
      <Navbar profileId={profileId} profile={profile} />
      <div className="streaming-layout">
        <div className="content-container" style={{ paddingTop: '120px', marginTop: 0 }}>
          <div className="row-header" style={{ padding: '0 60px', marginBottom: '30px' }}>
            <a href="javascript:history.back()" className="back-btn" style={{ marginRight: '20px', width: '40px', height: '40px', display: 'inline-flex' }}>
              <span className="iconify" data-icon="lucide:arrow-left" data-width="24" data-height="24"></span>
            </a>
            <h1 style={{ fontSize: '2.5rem', fontWeight: '800', color: '#fff', margin: 0 }}>{title}</h1>
          </div>
          
          {items.length === 0 ? (
            <div className="loading" style={{ padding: '40px', textAlign: 'center', color: '#666' }}>No items found in this catalog.</div>
          ) : (
            <div className="media-grid">
              {items.map(item => (
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
      </div>
    </Layout>
  )
}