import { Layout } from '../../components/Layout'
import { Navbar } from '../../components/Navbar'
import { MetaPreview } from '../../services/addons/types'

interface CatalogSection {
  title: string
  items: MetaPreview[]
}

interface StreamingCategoryProps {
  catalogs: CatalogSection[]
  profileId: number
  type: 'movie' | 'series'
}

export const StreamingCategory = ({ catalogs, profileId, type }: StreamingCategoryProps) => {
  const title = type === 'movie' ? 'Films' : 'Series'
  
  return (
    <Layout title={title} additionalCSS={['/static/css/streaming.css']}>
      <Navbar profileId={profileId} activePage={type} />
      <div className="streaming-layout">
        <div className="content-container" style={{ paddingTop: '40px' }}>
          <h1 style={{ padding: '0 40px', marginBottom: '30px', fontSize: '2.5rem', fontWeight: '800' }}>{title}</h1>
          
          {catalogs.length === 0 ? (
            <div className="loading" style={{ padding: '40px', textAlign: 'center' }}>No catalogs found.</div>
          ) : (
            catalogs.map((section, idx) => (
              <div key={idx} className="content-row">
                <div className="row-header">
                  <h2 className="row-title">{section.title}</h2>
                </div>
                <div className="media-grid" style={{ padding: '0', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
                  {section.items.map(item => (
                    <a key={item.id} href={`/streaming/${profileId}/${item.type}/${item.id}`} className="media-card" style={{ width: '100%' }}>
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
              </div>
            ))
          )}
        </div>
      </div>
    </Layout>
  )
}