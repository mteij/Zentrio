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

interface StreamingExploreProps {
  catalogs: CatalogSection[]
  items: MetaPreview[] // Filtered items
  filters: { types: string[], genres: string[] }
  activeFilters: { type?: string, genre?: string }
  history: WatchHistoryItem[]
  profileId: number
  profile?: any
}

export const StreamingExplore = ({ catalogs, items, filters, activeFilters, history, profileId, profile }: StreamingExploreProps) => {
  const showImdbRatings = profile?.settings?.show_imdb_ratings !== false;
  const featuredItem = items.length > 0 ? items[0] : (catalogs.length > 0 && catalogs[0].items.length > 0
    ? catalogs[0].items[0]
    : (history.length > 0 ? history[0] : null));

  const script = `
    function updateFilter(key, value) {
      const url = new URL(window.location.href);
      if (value) {
        url.searchParams.set(key, value);
      } else {
        url.searchParams.delete(key);
      }
      window.location.href = url.toString();
    }

    document.addEventListener('DOMContentLoaded', function() {
      let skip = ${items.length};
      let loading = false;
      let hasMore = true;
      const profileId = ${profileId};
      const type = "${activeFilters.type || ''}";
      const genre = "${activeFilters.genre || ''}";
      const grid = document.querySelector('.media-grid');
      
      // Only enable infinite scroll if we are in filtered view (items > 0)
      if ((!type && !genre) || !grid) return;

      window.addEventListener('scroll', async () => {
        if (loading || !hasMore) return;
        
        if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 500) {
          loading = true;
          
          try {
            const res = await fetch(\`/api/streaming/catalog?profileId=\${profileId}&type=\${type}&genre=\${genre}&skip=\${skip}\`);
            const data = await res.json();
            
            if (data.items && data.items.length > 0) {
              // Filter duplicates
              const existingIds = new Set(Array.from(grid.querySelectorAll('a')).map(a => a.getAttribute('href').split('/').pop()));
              const newItems = data.items.filter(item => !existingIds.has(item.id));
              
              if (newItems.length > 0) {
                 renderItems(newItems);
              }
              
              skip += data.items.length;
              if (data.items.length < 20) hasMore = false;
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
    <Layout title="Explore" additionalCSS={['/static/css/streaming.css']} additionalJS={['/static/js/streaming-ui.js']} showHeader={false} showFooter={false}>
      <Navbar profileId={profileId} activePage="explore" profile={profile} />
      <script dangerouslySetInnerHTML={{__html: script}} />
      
      <div className="streaming-layout no-hero">
        <div className="content-container" style={{ marginTop: '0' }}>
          
          <div style={{ padding: '0 60px', marginBottom: '30px' }}>
            <h1 style={{ fontSize: '3rem', fontWeight: '800', margin: 0 }}>Explore</h1>
          </div>

          {/* Filters Section */}
          <div className="filters-section" style={{ padding: '0 60px', marginBottom: '40px', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <select 
              className="filter-select" 
              value={activeFilters.type || ''} 
              onchange="updateFilter('type', this.value)"
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                color: '#fff',
                padding: '10px 20px',
                borderRadius: '8px',
                fontSize: '1rem',
                cursor: 'pointer',
                outline: 'none'
              }}
            >
              <option value="" style={{ color: '#000' }}>All Types</option>
              {filters.types.map(t => (
                <option key={t} value={t} style={{ color: '#000' }}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
              ))}
            </select>

            <select 
              className="filter-select" 
              value={activeFilters.genre || ''} 
              onchange="updateFilter('genre', this.value)"
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                color: '#fff',
                padding: '10px 20px',
                borderRadius: '8px',
                fontSize: '1rem',
                cursor: 'pointer',
                outline: 'none'
              }}
            >
              <option value="" style={{ color: '#000' }}>All Genres</option>
              {filters.genres.map(g => (
                <option key={g} value={g} style={{ color: '#000' }}>{g}</option>
              ))}
            </select>
          </div>

          {/* Filtered Results Grid */}
          {items.length > 0 ? (
             <div className="content-row">
               <div className="row-header">
                 <h2 className="row-title">
                   {activeFilters.genre ? `${activeFilters.genre} ` : ''}
                   {activeFilters.type ? (activeFilters.type === 'movie' ? 'Movies' : 'Series') : 'Results'}
                 </h2>
               </div>
               <div className="media-grid">
                 {items.map(item => {
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
             </div>
          ) : (
            /* Default Catalogs View (if no filters or no results) */
            <>
              {catalogs.length === 0 && (activeFilters.type || activeFilters.genre) ? (
                <div className="loading" style={{ padding: '40px', textAlign: 'center', color: '#666' }}>No results found for these filters.</div>
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
            </>
          )}
        </div>
      </div>
    </Layout>
  )
}