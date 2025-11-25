import { Layout } from '../../components/Layout'
import { Navbar } from '../../components/Navbar'
import { MetaPreview } from '../../services/addons/types'
import { WatchHistoryItem } from '../../services/database'

interface CatalogSection {
  title: string
  items: MetaPreview[]
}

interface StreamingExploreProps {
  catalogs: CatalogSection[]
  history: WatchHistoryItem[]
  profileId: number
  profile?: any
}

export const StreamingExplore = ({ catalogs, history, profileId, profile }: StreamingExploreProps) => {
  const featuredItem = catalogs.length > 0 && catalogs[0].items.length > 0
    ? catalogs[0].items[0]
    : (history.length > 0 ? history[0] : null);

  return (
    <Layout title="Explore" additionalCSS={['/static/css/streaming.css']}>
      <Navbar profileId={profileId} activePage="explore" profile={profile} />
      
      <div className="streaming-layout">
        {featuredItem && (
          <div className="hero-section">
            <div className="hero-backdrop">
              {(featuredItem as any).background ? (
                <img src={(featuredItem as any).background} alt="Hero Background" />
              ) : featuredItem.poster ? (
                <img src={featuredItem.poster} alt="Hero Background" style={{ filter: 'blur(20px)', transform: 'scale(1.1)' }} />
              ) : (
                <div style={{ width: '100%', height: '100%', background: '#141414' }}></div>
              )}
            </div>
            <div className="hero-overlay"></div>
            <div className="hero-content">
              <div className="hero-info">
                <h1 className="hero-title">{(featuredItem as any).title || (featuredItem as any).name}</h1>
                <p className="hero-description">{(featuredItem as any).description || 'Start watching now on Zentrio.'}</p>
                <div className="hero-actions">
                  <a href={`/streaming/${profileId}/${(featuredItem as any).meta_type || (featuredItem as any).type}/${(featuredItem as any).meta_id || (featuredItem as any).id}`} className="btn-hero btn-play">
                    <span className="iconify" data-icon="lucide:play" data-width="20" data-height="20" style={{ fill: 'currentColor' }}></span>
                    Play Now
                  </a>
                  <a href={`/streaming/${profileId}/${(featuredItem as any).meta_type || (featuredItem as any).type}/${(featuredItem as any).meta_id || (featuredItem as any).id}`} className="btn-hero btn-more">
                    <span className="iconify" data-icon="lucide:info" data-width="20" data-height="20"></span>
                    More Info
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="content-container" style={{ marginTop: featuredItem ? '-100px' : '40px', position: 'relative', zIndex: 10 }}>
          {history.length > 0 && (
            <div className="content-row">
              <div className="row-header">
                <h2 className="row-title">Continue Watching</h2>
              </div>
              <div className="row-scroll-container">
                {history.map(item => (
                  <a key={item.meta_id} href={`/streaming/${profileId}/${item.meta_type}/${item.meta_id}`} className="media-card">
                    <div className="poster-container">
                      {item.poster ? (
                        <img src={item.poster} alt={item.title} className="poster-image" loading="lazy" />
                      ) : (
                        <div className="no-poster">{item.title}</div>
                      )}
                      {item.duration && item.position && (
                        <div className="progress-bar" style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '4px', background: 'rgba(0,0,0,0.5)' }}>
                          <div className="progress" style={{ height: '100%', background: '#e50914', width: `${(item.position / item.duration) * 100}%` }}></div>
                        </div>
                      )}
                      <div className="card-overlay">
                        <div className="card-title">{item.title}</div>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}

          {catalogs.length === 0 ? (
            <div className="loading" style={{ padding: '40px', textAlign: 'center' }}>No catalogs found.</div>
          ) : (
            catalogs.map((section, idx) => (
              <div key={idx} className="content-row">
                <div className="row-header">
                  <h2 className="row-title">{section.title}</h2>
                </div>
                <div className="row-scroll-container">
                  {section.items.map(item => (
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
              </div>
            ))
          )}
        </div>
      </div>
    </Layout>
  )
}