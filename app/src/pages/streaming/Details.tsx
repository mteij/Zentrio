import { Layout, Button } from '../../components/index'
import { Navbar } from '../../components/Navbar'
import { MetaDetail, Stream, Manifest } from '../../services/addons/types'

interface StreamingDetailsProps {
  meta: MetaDetail
  streams: { addon: Manifest, streams: Stream[] }[]
  profileId: number
  inLibrary: boolean
  profile?: any
}

export const StreamingDetails = ({ meta, streams, profileId, inLibrary, profile }: StreamingDetailsProps) => {
  const script = `
    document.addEventListener('DOMContentLoaded', function() {
      const btn = document.getElementById('libraryBtn');
      const profileId = ${profileId};
      const meta = ${JSON.stringify(meta).replace(new RegExp('`', 'g'), '\\`')};
      
      // Initialize ListModal when available
      function initListModal() {
        if (typeof ListModal === 'undefined') {
          setTimeout(initListModal, 50);
          return;
        }
        
        const listModal = new ListModal(profileId);
        window.listModal = listModal;

        if (btn) {
          btn.addEventListener('click', () => {
            listModal.open(meta, async () => {
              // Update button state based on whether it's in ANY list
              try {
                const res = await fetch(\`/api/lists/check/\${meta.id}?profileId=\${profileId}\`);
                const data = await res.json();
                const inAnyList = data.listIds.length > 0;
                
                btn.setAttribute('data-in-library', String(inAnyList));
                btn.innerHTML = inAnyList
                  ? '<span class="iconify" data-icon="lucide:check" data-width="20" data-height="20"></span> In List'
                  : '<span class="iconify" data-icon="lucide:plus" data-width="20" data-height="20"></span> Add to List';
                btn.classList.toggle('active', inAnyList);
              } catch (e) {
                console.error('Failed to check list status', e);
              }
            });
          });
        }
      }
      
      initListModal();

      // View switching logic for series
      const episodesView = document.getElementById('episodesView');
      const streamsView = document.getElementById('streamsView');
      const backToEpisodesBtn = document.getElementById('backToEpisodesBtn');
      const selectedEpisodeTitle = document.getElementById('selectedEpisodeTitle');

      function showEpisodes() {
        if (episodesView) episodesView.style.display = 'block';
        if (streamsView) streamsView.style.display = 'none';
      }

      function showStreams(season, episode, title) {
        if (episodesView) episodesView.style.display = 'none';
        if (streamsView) streamsView.style.display = 'block';
        if (selectedEpisodeTitle) selectedEpisodeTitle.textContent = \`S\${season}:E\${episode} - \${title || 'Episode ' + episode}\`;
        loadStreams(season, episode);
      }

      if (backToEpisodesBtn) {
        backToEpisodesBtn.addEventListener('click', () => {
          showEpisodes();
        });
      }

      async function loadStreams(season, episode) {
        const streamsContainer = document.getElementById('streamsContainer');
        const streamsLoading = document.getElementById('streamsLoading');
        const streamsList = document.getElementById('streamsList');
        const noStreams = document.getElementById('noStreams');

        if (streamsContainer) streamsContainer.style.display = 'block';
        if (streamsLoading) streamsLoading.style.display = 'block';
        if (streamsList) streamsList.style.display = 'none';
        if (noStreams) noStreams.style.display = 'none';

        try {
          const fetchId = meta.imdb_id || meta.id;
          let url = \`/api/streaming/streams/\${meta.type}/\${fetchId}?profileId=\${profileId}\`;
          if (meta.type === 'series' && season && episode) {
            url += \`&season=\${season}&episode=\${episode}\`;
          }
          const res = await fetch(url);
          if (!res.ok) throw new Error(\`Request failed: \${res.status}\`);
          const data = await res.json();
          
          if (data.streams && data.streams.length > 0) {
            renderStreams(data.streams);
            if (streamsList) streamsList.style.display = 'block';
          } else {
            if (noStreams) noStreams.style.display = 'block';
          }
        } catch (e) {
          console.error('Failed to load streams', e);
          if (noStreams) {
            noStreams.style.display = 'block';
            noStreams.textContent = 'Error loading streams.';
          }
        } finally {
          if (streamsLoading) streamsLoading.style.display = 'none';
        }
      }

      function renderStreams(streamGroups) {
        const streamsList = document.getElementById('streamsList');
        if (!streamsList) return;
        
        streamsList.innerHTML = streamGroups.map((group, idx) => \`
          <div key="\${idx}" class="addon-group">
            <div class="addon-title">
              \${group.addon.logo_url ? \`
                <img src="\${group.addon.logo_url}" alt="\${group.addon.name}" style="width: 16px; height: 16px; margin-right: 8px; vertical-align: middle;" />
              \` : \`
                <span class="iconify" data-icon="lucide:box" data-width="16" data-height="16"></span>
              \`}
              \${group.addon.name}
            </div>
            <div class="stream-list">
              \${group.streams.map((stream, sIdx) => \`
                <a
                  key="\${sIdx}"
                  href="/streaming/\${profileId}/player?stream=\${encodeURIComponent(JSON.stringify(stream))}&meta=\${encodeURIComponent(JSON.stringify({ id: meta.id, type: meta.type, name: meta.name, poster: meta.poster }))}"
                  class="stream-item"
                >
                  <div class="stream-name">\${stream.title || stream.name || \`Stream \${sIdx + 1}\`}</div>
                  <div class="stream-details">\${stream.description || ''}</div>
                </a>
              \`).join('')}
            </div>
          </div>
        \`).join('');
        
        streamsList.style.display = 'block';
      }

      if (meta.type === 'series' && meta.videos) {
        const seasonSelector = document.getElementById('seasonSelector');
        const episodeList = document.getElementById('episodeList');

        function renderEpisodes(season) {
          const episodes = meta.videos.filter(v => v.season == season);
          const now = new Date();
          
          episodeList.innerHTML = episodes.map(ep => {
            const released = ep.released ? new Date(ep.released) : null;
            const isUnreleased = released && released > now;
            
            return \`
            <div class="episode-item" onclick="window.selectEpisode('\${ep.season}', '\${ep.number}', '\${(ep.title || ep.name || '').replace(/'/g, "\\'")}', event)" style="
              display: flex;
              align-items: center;
              justify-content: space-between;
              padding: 16px;
              background: rgba(255, 255, 255, 0.05);
              border-radius: 8px;
              margin-bottom: 8px;
              cursor: pointer;
              transition: background 0.2s;
              opacity: \${isUnreleased ? '0.7' : '1'};
            " onmouseover="this.style.background='rgba(255, 255, 255, 0.1)'" onmouseout="this.style.background='rgba(255, 255, 255, 0.05)'">
              <div class="episode-info" style="display: flex; align-items: center; gap: 16px;">
                \${ep.thumbnail ? \`<img src="\${ep.thumbnail}" alt="Thumbnail" style="width: 120px; height: 68px; object-fit: cover; border-radius: 4px;" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';" /><div style="display:none; width: 120px; height: 68px; background: rgba(0, 0, 0, 0.3); border-radius: 4px;"></div>\` : \`<div style="width: 120px; height: 68px; background: rgba(0, 0, 0, 0.3); border-radius: 4px;"></div>\`}
                <div style="display: flex; flex-direction: column; gap: 4px;">
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <span class="episode-number" style="font-weight: bold; color: #aaa; min-width: 24px;">\${ep.number}.</span>
                    <span class="episode-title" style="font-weight: 500;">\${ep.title || ep.name || 'Episode ' + ep.number}</span>
                    \${isUnreleased ? '<span style="font-size: 0.7rem; background: rgba(255, 165, 0, 0.2); color: orange; padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(255, 165, 0, 0.3);">Unreleased</span>' : ''}
                  </div>
                  \${ep.released ? \`<span style="font-size: 0.8rem; color: #888;">\${new Date(ep.released).toLocaleDateString()}</span>\` : ''}
                  \${ep.overview ? \`<span style="font-size: 0.85rem; color: #aaa; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">\${ep.overview}</span>\` : ''}
                </div>
              </div>
              <div style="display: flex; gap: 8px;">
                <button class="action-btn btn-secondary-glass" style="padding: 8px;" onclick="window.selectEpisode('\${ep.season}', '\${ep.number}', '\${(ep.title || ep.name || '').replace(/'/g, "\\'")}', event)">
                  <span class="iconify" data-icon="lucide:list" data-width="16" data-height="16"></span>
                </button>
                <button class="action-btn btn-primary-glass" style="padding: 8px;" onclick="window.playEpisode('\${ep.season}', '\${ep.number}', event)">
                  <span class="iconify" data-icon="lucide:play" data-width="16" data-height="16"></span>
                </button>
              </div>
            </div>
          \`}).join('');
        }

        // Expose functions to global scope
        window.selectEpisode = (season, number, title, event) => {
          if (event) event.stopPropagation();
          showStreams(season, number, title);
        };

        window.playEpisode = async (season, number, event) => {
          if (event) event.stopPropagation();
          const btn = event.currentTarget;
          const originalHtml = btn.innerHTML;
          btn.innerHTML = '<div class="spinner" style="width: 16px; height: 16px; border-width: 2px;"></div>';
          btn.disabled = true;

          try {
            const streams = await getStreams(season, number);
            if (streams && streams.length > 0) {
              // Find best stream (first one from first addon for now)
              const bestStream = streams[0].streams[0];
              window.location.href = \`/streaming/\${profileId}/player?stream=\${encodeURIComponent(JSON.stringify(bestStream))}&meta=\${encodeURIComponent(JSON.stringify({ id: meta.id, type: meta.type, name: meta.name, poster: meta.poster, season, episode: number }))}\`;
            } else {
              alert('No streams found');
              btn.innerHTML = originalHtml;
              btn.disabled = false;
            }
          } catch (e) {
            console.error(e);
            alert('Error finding streams');
            btn.innerHTML = originalHtml;
            btn.disabled = false;
          }
        };

        seasonSelector.addEventListener('change', (e) => {
          renderEpisodes(e.target.value);
        });

        if (meta.videos && meta.videos.length > 0) {
          renderEpisodes(seasonSelector.value);
        }
      } else {
        loadStreams();
      }

      const playBtn = document.getElementById('playBtn');
      if (playBtn) {
        playBtn.addEventListener('click', async () => {
          const streams = await getStreams();
          if (streams && streams.length > 0) {
            const bestStream = streams[0].streams[0];
            window.location.href = \`/streaming/\${profileId}/player?stream=\${encodeURIComponent(JSON.stringify(bestStream))}&meta=\${encodeURIComponent(JSON.stringify({ id: meta.id, type: meta.type, name: meta.name, poster: meta.poster }))}\`;
          } else {
            showMessage('No streams found', 'error');
          }
        });
      }

      async function getStreams(season, episode) {
        try {
          const fetchId = meta.imdb_id || meta.id;
          let url = \`/api/streaming/streams/\${meta.type}/\${fetchId}?profileId=\${profileId}\`;
          if (meta.type === 'series' && season && episode) {
            url += \`&season=\${season}&episode=\${episode}\`;
          }
          const res = await fetch(url);
          const data = await res.json();
          return data.streams;
        } catch (e) {
          console.error('Failed to get streams', e);
          return null;
        }
      }

    });
  `;

  return (
    <Layout title={meta.name} additionalCSS={['/static/css/streaming.css']} additionalJS={['/static/js/list-modal.js']} showHeader={false} showFooter={false}>
      <Navbar profileId={profileId} profile={profile} />
      
      <a href="javascript:history.back()" className="zentrio-back-btn">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
        </svg>
        Back
      </a>

      <div className="details-container">
        <div className="page-ambient-background" style={{
          backgroundImage: `url(${meta.background || meta.poster})`
        }}></div>

        <div className="details-content">
          <div className="details-poster">
            {meta.poster ? (
              <img src={meta.poster} alt={meta.name} />
            ) : (
              <div style={{ width: '100%', height: '100%', background: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {meta.name}
              </div>
            )}
          </div>

          <div className="details-info">
            <h1 className="details-title">{meta.name}</h1>
            
            <div className="details-meta-row">
              {meta.released && <span className="meta-badge">{meta.released.split('-')}</span>}
              {meta.runtime && <span className="meta-badge">{meta.runtime}</span>}
              {meta.imdbRating && <span className="meta-badge" style={{ background: '#f5c518', color: '#000' }}>IMDb {meta.imdbRating}</span>}
            </div>

            <div className="details-actions">
              <button id="playBtn" className="action-btn btn-primary-glass">
                <span className="iconify" data-icon="lucide:play" data-width="20" data-height="20" style={{ fill: 'currentColor' }}></span>
                Play
              </button>
              <button
                id="libraryBtn"
                className={"action-btn btn-secondary-glass " + (inLibrary ? 'active' : '')}
                data-in-library={String(inLibrary)}
              >
                <span className="iconify" data-icon={inLibrary ? "lucide:check" : "lucide:plus"} data-width="20" data-height="20"></span>
                {inLibrary ? 'In List' : 'Add to List'}
              </button>
            </div>

            <p className="details-description">{meta.description}</p>
            
            <div className="cast-info" style={{ marginBottom: '30px', color: '#ccc' }}>
              {meta.director && <p style={{ marginBottom: '8px' }}><strong>Director:</strong> {meta.director.join(', ')}</p>}
              {meta.cast && <p><strong>Cast:</strong> {meta.cast.join(', ')}</p>}
            </div>

            {meta.type === 'series' && meta.videos ? (
              <>
                <div id="episodesView">
                  <div className="series-episodes-container">
                    <div className="season-selector">
                      <select id="seasonSelector" style={{ color: '#fff', background: 'rgba(255, 255, 255, 0.1)', border: '1px solid rgba(255, 255, 255, 0.2)', padding: '8px 16px', borderRadius: '8px', outline: 'none' }}>
                        {(() => {
                          const seasons = Array.from(new Set(meta.videos.map(v => v.season || 0))).sort((a, b) => a - b);
                          // Filter out season 0 if there are other seasons
                          const filteredSeasons = seasons.length > 1 ? seasons.filter(s => s !== 0) : seasons;
                          
                          return filteredSeasons.map(season => (
                            <option key={season} value={season} style={{ color: '#000' }}>Season {season}</option>
                          ));
                        })()}
                      </select>
                    </div>
                    <div id="episodeList" className="episode-list">
                      {/* Episodes will be rendered here by script */}
                    </div>
                  </div>
                </div>

                <div id="streamsView" style={{ display: 'none' }}>
                  <div className="streams-header-row" style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
                    <button id="backToEpisodesBtn" className="action-btn btn-secondary-glass" style={{ padding: '8px 16px' }}>
                      <span className="iconify" data-icon="lucide:arrow-left" data-width="16" data-height="16"></span>
                      Back
                    </button>
                    <h2 id="selectedEpisodeTitle" style={{ margin: 0, fontSize: '1.2rem' }}></h2>
                  </div>
                  
                  <div className="streams-container" id="streamsContainer">
                    <div id="streamsLoading" className="loading" style={{ display: 'block', padding: '20px', textAlign: 'center' }}>
                      <div className="spinner" style={{ margin: '0 auto 10px' }}></div>
                      <p style={{ color: '#aaa' }}>Loading streams...</p>
                    </div>
                    
                    <div id="streamsList" className="streams-list-wrapper" style={{ display: 'none' }}>
                      {/* Streams will be rendered here */}
                    </div>
                    
                    <div id="noStreams" style={{ display: 'none', padding: '20px', textAlign: 'center', color: '#aaa' }}>
                      No streams found.
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="streams-container" id="streamsContainer">
                <h2 className="streams-header">Streams</h2>
                <div id="streamsLoading" className="loading" style={{ display: 'block', padding: '20px', textAlign: 'center' }}>
                  <div className="spinner" style={{ margin: '0 auto 10px' }}></div>
                  <p style={{ color: '#aaa' }}>Loading streams...</p>
                </div>
                
                <div id="streamsList" className="streams-list-wrapper" style={{ display: 'none' }}>
                  {/* Streams will be rendered here */}
                </div>
                
                <div id="noStreams" style={{ display: 'none', padding: '20px', textAlign: 'center', color: '#aaa' }}>
                  No streams found.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <script dangerouslySetInnerHTML={{__html: script }} />
    </Layout>
  )
}