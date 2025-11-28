import { Layout } from '../../components/Layout'
import { Navbar } from '../../components/Navbar'
import { MetaPreview } from '../../services/addons/types'
import { listDb } from '../../services/database'
import { RatingBadge } from '../../components/RatingBadge'
import { LazyImage } from '../../components/LazyImage'

interface StreamingCatalogProps {
  items: MetaPreview[]
  title: string
  profileId: number
  profile?: any
  manifestUrl?: string
  type?: string
  id?: string
}

export const StreamingCatalog = ({ items, title, profileId, profile, manifestUrl, type, id }: StreamingCatalogProps) => {
  const showImdbRatings = profile?.settings?.show_imdb_ratings !== false;
  const script = `
    document.addEventListener('DOMContentLoaded', function() {
      let skip = ${items.length};
      let loading = false;
      let hasMore = true;
      const profileId = ${profileId};
      const manifestUrl = "${manifestUrl ? encodeURIComponent(manifestUrl) : ''}";
      const type = "${type || ''}";
      const id = "${id || ''}";
      const grid = document.querySelector('.media-grid');
      
      if (!manifestUrl || !type || !id) return;

      window.addEventListener('scroll', async () => {
        if (loading || !hasMore) return;
        
        if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 500) {
          loading = true;
          
          try {
            const res = await fetch(\`/api/streaming/catalog?profileId=\${profileId}&manifestUrl=\${manifestUrl}&type=\${type}&id=\${id}&skip=\${skip}\`);
            const data = await res.json();
            
            if (data.items && data.items.length > 0) {
              // Filter duplicates
              const existingIds = new Set(Array.from(grid.querySelectorAll('a')).map(a => a.getAttribute('href').split('/').pop()));
              const newItems = data.items.filter(item => !existingIds.has(item.id));
              
              if (newItems.length === 0) {
                 // If all items are duplicates, we might have reached the end or just a bad batch
                 // Let's increment skip anyway
              } else {
                 renderItems(newItems);
              }
              
              skip += data.items.length;
              if (data.items.length < 20) hasMore = false; // Assuming default limit is around 20-100
            } else {
              hasMore = false;
            }
          } catch (e) {
            console.error('Failed to load more items', e);
          } finally {
            loading = false;
          }
        }
      });

      function renderItems(items) {
        const html = items.map(item => \`
          <a key="\${item.id}" href="/streaming/\${profileId}/\${item.type}/\${item.id}" class="media-card">
            <div class="poster-container">
              \${item.poster ? \`
                <img src="\${item.poster}" alt="\${item.name}" class="poster-image" loading="lazy" />
              \` : \`
                <div class="no-poster">\${item.name}</div>
              \`}
              <div class="card-overlay">
                <div class="card-title">\${item.name}</div>
              </div>
            </div>
          </a>
        \`).join('');
        grid.insertAdjacentHTML('beforeend', html);
      }
    });
  `;

  return (
    <Layout title={title} additionalCSS={['/static/css/streaming.css']} showHeader={false} showFooter={false}>
      <Navbar profileId={profileId} profile={profile} />
      <script dangerouslySetInnerHTML={{__html: script}} />
      
      <a href="javascript:history.back()" className="zentrio-back-btn">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
        </svg>
        Back
      </a>

      <div className="streaming-layout">
        <div className="content-container" style={{ paddingTop: '120px', marginTop: 0 }}>
          <div className="row-header" style={{ padding: '0 60px', marginBottom: '30px' }}>
            <h1 style={{ fontSize: '2.5rem', fontWeight: '800', color: '#fff', margin: 0 }}>{title}</h1>
          </div>
          
          {items.length === 0 ? (
            <div className="loading" style={{ padding: '40px', textAlign: 'center', color: '#666' }}>No items found in this catalog.</div>
          ) : (
            <div className="media-grid">
              {items.map(item => {
                const inList = listDb.isInAnyList(profileId, item.id);
                return (
                  <a key={item.id} href={`/streaming/${profileId}/${item.type}/${item.id}`} className="media-card">
                    <div className="poster-container">
                      {item.poster ? (
                        <LazyImage src={item.poster} alt={item.name} className="poster-image" />
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
          )}
        </div>
      </div>
    </Layout>
  )
}