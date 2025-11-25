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
    (function() {
      const btn = document.getElementById('libraryBtn');
      const profileId = ${profileId};
      const meta = ${JSON.stringify(meta).replace(new RegExp('`', 'g'), '\\`')};
      const streamsContainer = document.getElementById('streamsContainer');
      const streamsLoading = document.getElementById('streamsLoading');
      const streamsList = document.getElementById('streamsList');
      const noStreams = document.getElementById('noStreams');
      
      if (btn) {
        btn.addEventListener('click', async () => {
          const inLibrary = btn.getAttribute('data-in-library') === 'true';
          const action = inLibrary ? 'remove' : 'add';
          
          try {
            btn.disabled = true;
            const res = await fetch('/api/streaming/library', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                profileId,
                metaId: meta.id,
                type: meta.type,
                title: meta.name,
                poster: meta.poster,
                action
              })
            });
            
            if (res.ok) {
              const newState = !inLibrary;
              btn.setAttribute('data-in-library', String(newState));
              btn.innerHTML = newState
                ? '<span class="iconify" data-icon="lucide:check" data-width="20" data-height="20"></span> In My List'
                : '<span class="iconify" data-icon="lucide:plus" data-width="20" data-height="20"></span> Add to List';
              btn.classList.toggle('active', newState);
            }
          } catch (e) {
            console.error('Library action failed', e);
          } finally {
            btn.disabled = false;
          }
        });
      }

      async function loadStreams(season, episode) {
        streamsContainer.style.display = 'block';
        streamsLoading.style.display = 'block';
        streamsList.style.display = 'none';
        noStreams.style.display = 'none';

        try {
          const fetchId = meta.imdb_id || meta.id;
          let url = \`/api/streaming/streams/\${meta.type}/\${fetchId}?profileId=\${profileId}\`;
          if (meta.type === 'series' && season && episode) {
            url += \`&season=\${season}&episode=\${episode}\`;
          }
          const res = await fetch(url);
          const data = await res.json();
          
          if (data.streams && data.streams.length > 0) {
            renderStreams(data.streams);
            streamsList.style.display = 'block';
          } else {
            noStreams.style.display = 'block';
          }
        } catch (e) {
          console.error('Failed to load streams', e);
          noStreams.style.display = 'block';
          noStreams.textContent = 'Error loading streams.';
        } finally {
          streamsLoading.style.display = 'none';
        }
      }

      function renderStreams(streamGroups) {
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
          episodeList.innerHTML = episodes.map(ep => \`
            <div class="episode-item">
              <div class="episode-info">
                <span class="episode-number">\${ep.number}.</span>
                <span class="episode-title">\${ep.title}</span>
              </div>
              <button class="play-episode-btn" data-season="\${ep.season}" data-episode="\${ep.number}">Play</button>
            </div>
          \`).join('');
        }

        seasonSelector.addEventListener('change', (e) => {
          renderEpisodes(e.target.value);
        });

        episodeList.addEventListener('click', (e) => {
          if (e.target.classList.contains('play-episode-btn')) {
            const season = e.target.dataset.season;
            const episode = e.target.dataset.episode;
            loadStreams(season, episode);
          }
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

    })();
  `;

  return (
    <Layout title={meta.name} additionalCSS={['/static/css/streaming.css']}>
      <Navbar profileId={profileId} profile={profile} />
      
      <div className="details-container">
        <div className="details-backdrop">
          {meta.background ? (
            <img src={meta.background} alt="Backdrop" />
          ) : meta.poster ? (
            <img src={meta.poster} alt="Backdrop" style={{ filter: 'blur(20px)', transform: 'scale(1.1)' }} />
          ) : (
            <div style={{ width: '100%', height: '100%', background: '#141414' }}></div>
          )}
        </div>

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
                {inLibrary ? 'In My List' : 'Add to List'}
              </button>
            </div>

            <p className="details-description">{meta.description}</p>
            
            <div className="cast-info" style={{ marginBottom: '30px', color: '#ccc' }}>
              {meta.director && <p style={{ marginBottom: '8px' }}><strong>Director:</strong> {meta.director.join(', ')}</p>}
              {meta.cast && <p><strong>Cast:</strong> {meta.cast.join(', ')}</p>}
            </div>

            {meta.type === 'series' && meta.videos && (
              <div className="series-episodes-container">
                <div className="season-selector">
                  <select id="seasonSelector">
                    {Array.from(new Set(meta.videos.map(v => v.season))).map(season => (
                      <option key={season} value={season}>Season {season}</option>
                    ))}
                  </select>
                </div>
                <div id="episodeList" className="episode-list">
                  {/* Episodes will be rendered here by script */}
                </div>
              </div>
            )}

            <div className="streams-container" id="streamsContainer" style={{ display: meta.type === 'movie' ? 'block' : 'none' }}>
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
          </div>
        </div>
      </div>
      <script dangerouslySetInnerHTML={{__html: script }} />
    </Layout>
  )
}