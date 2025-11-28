import { Layout } from '../../components/Layout'
import { Navbar } from '../../components/Navbar'
import { MetaPreview } from '../../services/addons/types'
import { WatchHistoryItem, listDb } from '../../services/database'
import { RatingBadge } from '../../components/RatingBadge'

interface CatalogSection {
  title: string
  items: MetaPreview[]
  seeAllUrl?: string
}

interface StreamingHomeProps {
  catalogs: CatalogSection[]
  history: WatchHistoryItem[]
  profileId: number
  profile?: any
  trending?: MetaPreview[]
  showFallbackToast?: boolean
}

export const StreamingHome = ({ catalogs, history, profileId, profile, trending, showFallbackToast }: StreamingHomeProps) => {
  const showImdbRatings = profile?.settings?.show_imdb_ratings !== false;
  // Always show hero banner
  const showHero = true;

  // Find featured items (prioritize trending, then first items from first catalog or history)
  let featuredItems: (MetaPreview | WatchHistoryItem)[] = [];
  
  if (trending && trending.length > 0) {
    featuredItems = trending;
  } else if (catalogs.length > 0 && catalogs[0].items.length > 0) {
    featuredItems = catalogs[0].items.slice(0, 5);
  } else if (history.length > 0) {
    featuredItems = history.slice(0, 5);
  }

  const featuredItem = featuredItems.length > 0 ? featuredItems[0] : null;

  return (
    <Layout title="Streaming" additionalCSS={['/static/css/streaming.css']} additionalJS={['/static/js/streaming-ui.js']} showHeader={false} showFooter={false}>
      <Navbar profileId={profileId} activePage="home" profile={profile} />
      
      <div className={`streaming-layout ${!showHero ? 'no-hero' : ''}`}>
        {showHero && featuredItems.length > 0 && (
          <>
            <div className="page-ambient-background" id="ambientBackground" style={{
              backgroundImage: `url(${(featuredItem as any).background || featuredItem?.poster})`
            }}></div>
            
            <div className="hero-section" id="heroSection" data-items={JSON.stringify(featuredItems)}>
              <div className="hero-backdrop" id="heroBackdrop">
                {(featuredItem as any).background ? (
                  <img src={(featuredItem as any).background} alt="Hero Background" id="heroImage" />
                ) : featuredItem?.poster ? (
                  <img src={featuredItem.poster} alt="Hero Background" id="heroImage" style={{ filter: 'blur(20px)', transform: 'scale(1.1)' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', background: '#141414' }} id="heroImage"></div>
                )}
              </div>
              <div className="hero-overlay"></div>
              <div className="hero-content">
              <div className="hero-info" id="heroInfo">
                {trending && trending.length > 0 && (
                  <div className="trending-chip" id="trendingChip">
                    <span className="iconify" data-icon="lucide:trending-up" data-width="16" data-height="16"></span>
                    <span id="trendingText">#1 Trending Today</span>
                  </div>
                )}
                <h1 className="hero-title" id="heroTitle">{(featuredItem as any).title || (featuredItem as any).name}</h1>
                <p className="hero-description" id="heroDescription">{(featuredItem as any).description || 'Start watching now on Zentrio.'}</p>
                <div className="hero-actions">
                  <a href={`/streaming/${profileId}/${(featuredItem as any).meta_type || (featuredItem as any).type}/${(featuredItem as any).meta_id || (featuredItem as any).id}`} className="btn-hero btn-play" id="heroPlayBtn">
                    <span className="iconify" data-icon="lucide:play" data-width="24" data-height="24" style={{ fill: 'currentColor' }}></span>
                    Play Now
                  </a>
                  <a href={`/streaming/${profileId}/${(featuredItem as any).meta_type || (featuredItem as any).type}/${(featuredItem as any).meta_id || (featuredItem as any).id}`} className="btn-hero btn-more" id="heroMoreBtn">
                    <span className="iconify" data-icon="lucide:info" data-width="24" data-height="24"></span>
                    More Info
                  </a>
                </div>
              </div>
              </div>
            </div>
          </>
        )}

        <div className="content-container" style={{ marginTop: showHero && featuredItem ? '-100px' : '120px' }}>
          {history.length > 0 && (
            <div className="content-row">
              <div className="row-header">
                <h2 className="row-title">Continue Watching</h2>
              </div>
              <div className="row-wrapper">
                <button className="scroll-btn left" onclick="this.parentElement.querySelector('.row-scroll-container').scrollBy({left: -300, behavior: 'smooth'})">
                  <span className="iconify" data-icon="lucide:chevron-left" data-width="24" data-height="24"></span>
                </button>
                <div className="row-scroll-container">
                  {history.map(item => {
                    const inList = listDb.isInAnyList(profileId, item.meta_id);
                    return (
                      <a key={item.meta_id} href={`/streaming/${profileId}/${item.meta_type}/${item.meta_id}`} className="media-card">
                        <div className="poster-container">
                          {item.poster ? (
                            <img src={item.poster} alt={item.title} className="poster-image" loading="lazy" />
                          ) : (
                            <div className="no-poster">{item.title}</div>
                          )}
                          {/* Watch history items don't usually have imdbRating, but if they did: */}
                          {/* {showImdbRatings && item.imdbRating && (
                            <RatingBadge rating={parseFloat(item.imdbRating)} />
                          )} */}
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
                          {item.duration && item.position && (
                            <div className="progress-bar" style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '4px', background: 'rgba(255,255,255,0.3)' }}>
                              <div className="progress" style={{ height: '100%', background: 'var(--accent)', width: `${(item.position / item.duration) * 100}%` }}></div>
                            </div>
                          )}
                          <div className="card-overlay">
                            <div className="card-title">{item.title}</div>
                          </div>
                        </div>
                      </a>
                    );
                  })}
                </div>
                <button className="scroll-btn right" onclick="this.parentElement.querySelector('.row-scroll-container').scrollBy({left: 300, behavior: 'smooth'})">
                  <span className="iconify" data-icon="lucide:chevron-right" data-width="24" data-height="24"></span>
                </button>
              </div>
            </div>
          )}

          {catalogs.length === 0 ? (
            <div className="loading" style={{ padding: '40px', textAlign: 'center', color: '#666' }}>No catalogs found.</div>
          ) : (
            catalogs.map((section, idx) => (
              <div key={idx} className="content-row">
                <div className="row-header">
                  <h2 className="row-title">{section.title}</h2>
                  {section.seeAllUrl && (
                    <a href={section.seeAllUrl} className="see-all-link">See All</a>
                  )}
                </div>
                <div className="row-wrapper">
                  <button className="scroll-btn left" onclick="this.parentElement.querySelector('.row-scroll-container').scrollBy({left: -300, behavior: 'smooth'})">
                    <span className="iconify" data-icon="lucide:chevron-left" data-width="24" data-height="24"></span>
                  </button>
                  <div className="row-scroll-container">
                    {section.items.map(item => {
                      const inList = listDb.isInAnyList(profileId, item.id);
                      return (
                        <a key={item.id} href={`/streaming/${profileId}/${item.type}/${item.id}`} className="media-card">
                          <div className="poster-container">
                            {item.poster ? (
                              <img src={item.poster} alt={item.name} className="poster-image" loading="lazy" />
                            ) : (
                              <div className="no-poster">{item.name}</div>
                            )}
                            {showImdbRatings && item.imdbRating && (
                              <RatingBadge rating={parseFloat(item.imdbRating)} />
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
                  <button className="scroll-btn right" onclick="this.parentElement.querySelector('.row-scroll-container').scrollBy({left: 300, behavior: 'smooth'})">
                    <span className="iconify" data-icon="lucide:chevron-right" data-width="24" data-height="24"></span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      {showFallbackToast && (
        <script>
          {`
            document.addEventListener('DOMContentLoaded', () => {
              if (window.addToast) {
                window.addToast('message', 'Default Addon Used', 'No addons were found for this profile, so we are using the default Cinemeta addon to provide content.');
              }
            });
          `}
        </script>
      )}
    </Layout>
  )
}