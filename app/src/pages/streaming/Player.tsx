import { Layout } from '../../components/Layout'
import { Stream } from '../../services/addons/types'

interface StreamingPlayerProps {
  stream: Stream
  meta: { id: string, type: string, name: string, poster?: string, season?: number, episode?: number }
  profileId: number
}

export const StreamingPlayer = ({ stream, meta, profileId }: StreamingPlayerProps) => {
  return (
    <Layout title={`Playing: ${meta.name}`} additionalCSS={['/static/css/player.css']}>
      <div className="player-wrapper" id="playerWrapper">
        <video
          id="videoPlayer"
          className="video-element"
          autoPlay
          playsInline
          poster={meta.poster}
          crossOrigin="anonymous"
        >
          Your browser does not support the video tag.
        </video>

        <div className="brightness-overlay" id="brightnessOverlay"></div>
        
        <div className="gesture-feedback" id="gestureFeedback">
            <i id="gestureIcon" data-lucide="volume-2" style={{ width: 48, height: 48, marginBottom: 8 }}></i>
            <span id="gestureValue" style={{ fontSize: '1.5rem', fontWeight: 'bold' }}></span>
        </div>

        <div className="error-display" id="errorDisplay" style={{ display: 'none' }}>
            <div className="error-content">
                <i data-lucide="alert-circle" style={{ width: 48, height: 48, marginBottom: 16, color: '#e50914' }}></i>
                <p id="errorMessage" style={{ marginBottom: 20 }}>Playback Error</p>
                <button id="retryBtn" className="retry-btn">Retry</button>
            </div>
        </div>

        <div className="player-overlay" id="playerOverlay">
          <div className="player-top-bar">
            <a href={`/streaming/${profileId}/${meta.type}/${meta.id}`} className="back-btn">
              <i data-lucide="arrow-left" style={{ width: 24, height: 24 }}></i>
            </a>
            <div className="stream-info">
              <div className="stream-title">
                {meta.name}
                {meta.season && meta.episode && <span className="episode-tag">S{meta.season}:E{meta.episode}</span>}
              </div>
              <div className="stream-subtitle">{stream.title || stream.name || 'Playing'}</div>
            </div>
            <div className="top-right-controls">
                <button className="control-btn" id="settingsBtn" title="Settings">
                    <i data-lucide="settings" style={{ width: 24, height: 24 }}></i>
                </button>
            </div>
          </div>

          <div className="player-loading" id="playerLoading">
            <div className="spinner"></div>
          </div>

          <div className="player-controls">
            <div className="progress-container" id="progressContainer">
              <div className="progress-filled" id="progressBar">
                <div className="progress-thumb"></div>
              </div>
            </div>

            <div className="controls-row">
              <div className="left-controls">
                <button className="control-btn play-pause-btn" id="playPauseBtn">
                  <span id="playIconContainer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <i data-lucide="pause" style={{ width: 28, height: 28, fill: 'currentColor' }}></i>
                  </span>
                </button>
                
                <div className="volume-wrapper">
                  <button className="control-btn" id="muteBtn">
                    <i data-lucide="volume-2" id="volumeIcon" style={{ width: 24, height: 24 }}></i>
                  </button>
                  <div className="volume-container">
                    <input type="range" min="0" max="1" step="0.05" className="volume-slider" id="volumeSlider" />
                  </div>
                </div>

                <div className="time-display">
                  <span id="currentTime">0:00</span> / <span id="duration">0:00</span>
                </div>
              </div>

              <div className="right-controls">
                <button className="control-btn" id="nextSourceBtn" title="Find another source">
                    <i data-lucide="layers" style={{ width: 24, height: 24 }}></i>
                </button>
                <button className="control-btn" id="fullscreenBtn">
                  <i data-lucide="maximize" style={{ width: 24, height: 24 }}></i>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Settings Modal */}
        <div className="settings-modal" id="settingsModal">
            <div className="settings-content">
                <h3>Playback Settings</h3>
                
                <div className="setting-group">
                    <label>Playback Speed</label>
                    <select id="speedSelect">
                        <option value="0.5">0.5x</option>
                        <option value="0.75">0.75x</option>
                        <option value="1" selected>Normal</option>
                        <option value="1.25">1.25x</option>
                        <option value="1.5">1.5x</option>
                        <option value="2">2x</option>
                    </select>
                </div>

                <div className="setting-group">
                    <label>Audio Track</label>
                    <select id="audioSelect">
                        <option value="-1">Default</option>
                    </select>
                </div>

                <div className="setting-group">
                    <label>Subtitles</label>
                    <select id="subtitleSelect">
                        <option value="-1">Off</option>
                    </select>
                </div>

                <button className="close-settings-btn" id="closeSettingsBtn">Close</button>
            </div>
        </div>
      </div>

      {/* Load HLS.js and Dash.js from CDN */}
      <script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>
      <script src="https://cdn.dashjs.org/latest/dash.all.min.js"></script>

      <script dangerouslySetInnerHTML={{__html: `
        (function() {
          const video = document.getElementById('videoPlayer');
          const wrapper = document.getElementById('playerWrapper');
          const overlay = document.getElementById('playerOverlay');
          const playPauseBtn = document.getElementById('playPauseBtn');
          const playIconContainer = document.getElementById('playIconContainer');
          const progressBar = document.getElementById('progressBar');
          const progressContainer = document.getElementById('progressContainer');
          const volumeSlider = document.getElementById('volumeSlider');
          const muteBtn = document.getElementById('muteBtn');
          const volumeIcon = document.getElementById('volumeIcon');
          const fullscreenBtn = document.getElementById('fullscreenBtn');
          const currentTimeEl = document.getElementById('currentTime');
          const durationEl = document.getElementById('duration');
          const loadingSpinner = document.getElementById('playerLoading');
          const settingsBtn = document.getElementById('settingsBtn');
          const settingsModal = document.getElementById('settingsModal');
          const closeSettingsBtn = document.getElementById('closeSettingsBtn');
          const speedSelect = document.getElementById('speedSelect');
          const audioSelect = document.getElementById('audioSelect');
          const subtitleSelect = document.getElementById('subtitleSelect');
          const nextSourceBtn = document.getElementById('nextSourceBtn');

          const streamUrl = "${stream.url}";
          const profileId = ${profileId};
          const meta = ${JSON.stringify(meta)};
          
          let hlsInstance = null;
          
          // --- Platform Detection & Player Setup ---
          
          // Simple check for Tauri environment
          const isNative = !!window.__TAURI__;
          
          if (isNative) {
            // Native: Use native playback capabilities
            // Android/iOS webviews often support HLS natively.
            video.src = streamUrl;
            console.log('Native platform detected, using native playback capabilities');
          } else {
            // Web: Use HLS.js or Dash.js if needed
            const isHls = streamUrl.includes('.m3u8');
            const isDash = streamUrl.includes('.mpd');

            if (isHls && Hls.isSupported()) {
              const hls = new Hls();
              hlsInstance = hls;
              hls.loadSource(streamUrl);
              hls.attachMedia(video);
              hls.on(Hls.Events.MANIFEST_PARSED, function() {
                video.play().catch(e => console.log('Autoplay blocked', e));
                updateAudioTracks();
                updateSubtitles();
              });
              hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, updateAudioTracks);
              hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, updateSubtitles);
            } else if (isDash && typeof dashjs !== 'undefined') {
              const player = dashjs.MediaPlayer().create();
              player.initialize(video, streamUrl, true);
            } else {
              // Fallback for native support (Safari HLS, or direct MP4)
              video.src = streamUrl;
              // Native HLS support (Safari)
              if (video.canPlayType('application/vnd.apple.mpegurl')) {
                  video.addEventListener('loadedmetadata', () => {
                      updateAudioTracks();
                      updateSubtitles();
                  });
              }
            }
          }

          // --- Track Management ---

          function updateAudioTracks() {
              audioSelect.innerHTML = '<option value="-1">Default</option>';
              
              if (hlsInstance) {
                  hlsInstance.audioTracks.forEach((track, index) => {
                      const option = document.createElement('option');
                      option.value = index;
                      option.text = track.name || \`Track \${index + 1} (\${track.lang || 'unknown'})\`;
                      if (hlsInstance.audioTrack === index) option.selected = true;
                      audioSelect.appendChild(option);
                  });
              } else if (video.audioTracks) {
                   // Native audio tracks support
                   for (let i = 0; i < video.audioTracks.length; i++) {
                       const track = video.audioTracks[i];
                       const option = document.createElement('option');
                       option.value = i;
                       option.text = track.label || track.language || \`Track \${i + 1}\`;
                       if (track.enabled) option.selected = true;
                       audioSelect.appendChild(option);
                   }
              }
          }

          function updateSubtitles() {
              subtitleSelect.innerHTML = '<option value="-1">Off</option>';
              
              if (hlsInstance) {
                  hlsInstance.subtitleTracks.forEach((track, index) => {
                      const option = document.createElement('option');
                      option.value = index;
                      option.text = track.name || \`Subtitle \${index + 1} (\${track.lang || 'unknown'})\`;
                      if (hlsInstance.subtitleTrack === index) option.selected = true;
                      subtitleSelect.appendChild(option);
                  });
              } else if (video.textTracks) {
                  // Native text tracks
                  for (let i = 0; i < video.textTracks.length; i++) {
                      const track = video.textTracks[i];
                      // Only show subtitles/captions
                      if (track.kind === 'subtitles' || track.kind === 'captions') {
                          const option = document.createElement('option');
                          option.value = i;
                          option.text = track.label || track.language || \`Subtitle \${i + 1}\`;
                          if (track.mode === 'showing') option.selected = true;
                          subtitleSelect.appendChild(option);
                      }
                  }
              }
          }

          audioSelect.addEventListener('change', (e) => {
              const index = parseInt(e.target.value);
              if (hlsInstance) {
                  hlsInstance.audioTrack = index;
              } else if (video.audioTracks) {
                  for (let i = 0; i < video.audioTracks.length; i++) {
                      video.audioTracks[i].enabled = (i === index);
                  }
              }
          });

          subtitleSelect.addEventListener('change', (e) => {
              const index = parseInt(e.target.value);
              if (hlsInstance) {
                  hlsInstance.subtitleTrack = index;
              } else if (video.textTracks) {
                  for (let i = 0; i < video.textTracks.length; i++) {
                      const track = video.textTracks[i];
                      if (track.kind === 'subtitles' || track.kind === 'captions') {
                          // We can't easily map index back to track list index if we filtered, 
                          // but for simplicity assuming direct mapping or just iterating all
                          // Ideally we store track reference.
                          // Simple approach: disable all, enable selected if match
                          track.mode = 'hidden';
                      }
                  }
                  if (index !== -1 && video.textTracks[index]) {
                      video.textTracks[index].mode = 'showing';
                  }
              }
          });

          speedSelect.addEventListener('change', (e) => {
              video.playbackRate = parseFloat(e.target.value);
          });


          // --- Gestures & Error Handling ---
          const brightnessOverlay = document.getElementById('brightnessOverlay');
          const gestureFeedback = document.getElementById('gestureFeedback');
          const gestureIcon = document.getElementById('gestureIcon');
          const gestureValue = document.getElementById('gestureValue');
          const errorDisplay = document.getElementById('errorDisplay');
          const errorMessage = document.getElementById('errorMessage');
          const retryBtn = document.getElementById('retryBtn');

          let touchStartX = 0;
          let touchStartY = 0;
          let touchStartTime = 0;
          let lastTapTime = 0;
          let isDragging = false;
          let dragType = null; // 'volume' or 'brightness'
          let startVolume = 1;
          let startBrightness = 1;
          let currentBrightness = 1;

          wrapper.addEventListener('touchstart', (e) => {
              // Only handle single touch gestures
              if (e.touches.length !== 1) return;
              
              // Don't interfere with controls
              if (e.target.closest('.player-controls') || e.target.closest('.player-top-bar') || e.target.closest('.settings-modal')) {
                  return;
              }

              touchStartX = e.touches[0].clientX;
              touchStartY = e.touches[0].clientY;
              touchStartTime = Date.now();
              startVolume = video.volume;
              startBrightness = currentBrightness;
              isDragging = false;
              dragType = null;
          }, { passive: false });

          wrapper.addEventListener('touchmove', (e) => {
              if (e.touches.length !== 1 || !touchStartX) return;
              
              const deltaX = e.touches[0].clientX - touchStartX;
              const deltaY = touchStartY - e.touches[0].clientY; // Up is positive
              
              if (!isDragging) {
                  // Threshold for drag detection
                  if (Math.abs(deltaY) > 20 && Math.abs(deltaY) > Math.abs(deltaX)) {
                      isDragging = true;
                      // Determine side
                      if (touchStartX < window.innerWidth / 2) {
                          dragType = 'brightness';
                      } else {
                          dragType = 'volume';
                      }
                  }
              }

              if (isDragging) {
                  e.preventDefault();
                  const percentChange = deltaY / (window.innerHeight * 0.5);
                  
                  if (dragType === 'volume') {
                      let newVol = Math.max(0, Math.min(1, startVolume + percentChange));
                      video.volume = newVol;
                      if (volumeSlider) volumeSlider.value = newVol;
                      showGestureFeedback('volume', Math.round(newVol * 100) + '%');
                  } else if (dragType === 'brightness') {
                      let newBright = Math.max(0.1, Math.min(1, startBrightness + percentChange));
                      currentBrightness = newBright;
                      if (brightnessOverlay) brightnessOverlay.style.opacity = (1 - currentBrightness);
                      showGestureFeedback('sun', Math.round(newBright * 100) + '%');
                  }
              }
          }, { passive: false });

          wrapper.addEventListener('touchend', (e) => {
              const now = Date.now();
              if (!isDragging && touchStartX) {
                  // Check for tap
                  if (now - touchStartTime < 250) {
                      // Check for double tap
                      if (now - lastTapTime < 300) {
                          // Double tap detected
                          const width = window.innerWidth;
                          // Avoid center area for double taps (leave it for play/pause or controls)
                          if (touchStartX < width * 0.35) {
                              // Left side double tap - seek back
                              video.currentTime = Math.max(0, video.currentTime - 10);
                              showGestureFeedback('rewind', '-10s');
                          } else if (touchStartX > width * 0.65) {
                              // Right side double tap - seek forward
                              video.currentTime = Math.min(video.duration, video.currentTime + 10);
                              showGestureFeedback('fast-forward', '+10s');
                          }
                          lastTapTime = 0; // Reset
                      } else {
                          lastTapTime = now;
                      }
                  }
              }
              isDragging = false;
              touchStartX = 0;
              if (gestureFeedback) gestureFeedback.style.opacity = '0';
          });

          function showGestureFeedback(icon, text) {
              if (!gestureFeedback) return;
              gestureFeedback.style.opacity = '1';
              gestureValue.textContent = text;
              
              let iconName = 'activity';
              if (icon === 'volume') {
                  if (video.volume === 0) iconName = 'volume-x';
                  else if (video.volume < 0.5) iconName = 'volume-1';
                  else iconName = 'volume-2';
              } else if (icon === 'sun') {
                  iconName = 'sun';
              } else if (icon === 'rewind') {
                  iconName = 'rewind';
              } else if (icon === 'fast-forward') {
                  iconName = 'fast-forward';
              }
              
              gestureIcon.setAttribute('data-lucide', iconName);
              if (window.lucide) window.lucide.createIcons();
          }

          // Error Handling
          video.addEventListener('error', (e) => {
              console.error('Video Error:', video.error);
              if (loadingSpinner) loadingSpinner.style.display = 'none';
              if (errorDisplay) errorDisplay.style.display = 'flex';
              if (errorMessage) errorMessage.textContent = 'Playback Error';
          });

          if (retryBtn) {
              retryBtn.addEventListener('click', () => {
                  if (errorDisplay) errorDisplay.style.display = 'none';
                  if (loadingSpinner) loadingSpinner.style.display = 'block';
                  
                  // Try to reload
                  const currentTime = video.currentTime;
                  
                  if (hlsInstance) {
                      hlsInstance.recoverMediaError();
                  } else {
                      video.load();
                      video.currentTime = currentTime;
                      video.play().catch(console.error);
                  }
              });
          }

          // --- UI Logic ---

          function formatTime(seconds) {
            const m = Math.floor(seconds / 60);
            const s = Math.floor(seconds % 60);
            return m + ':' + (s < 10 ? '0' : '') + s;
          }

          function updatePlayIcon() {
            const iconName = video.paused ? 'play' : 'pause';
            if (playIconContainer) {
                playIconContainer.innerHTML = '<i data-lucide="' + iconName + '" style="width: 28px; height: 28px; fill: currentColor;"></i>';
                if (window.lucide) window.lucide.createIcons();
            }

            if (video.paused) {
              wrapper.classList.add('paused');
            } else {
              wrapper.classList.remove('paused');
            }
          }

          playPauseBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent wrapper click
            if (video.paused) video.play();
            else video.pause();
          });

          video.addEventListener('play', updatePlayIcon);
          video.addEventListener('pause', updatePlayIcon);
          
          // Click on video to toggle play/pause
          video.addEventListener('click', (e) => {
              e.stopPropagation();
              if (video.paused) video.play();
              else video.pause();
          });
          
          video.addEventListener('waiting', () => {
            loadingSpinner.style.display = 'block';
          });
          
          video.addEventListener('playing', () => {
            loadingSpinner.style.display = 'none';
          });

          video.addEventListener('timeupdate', () => {
            const percent = (video.currentTime / video.duration) * 100;
            progressBar.style.width = percent + '%';
            currentTimeEl.textContent = formatTime(video.currentTime);
            if (!isNaN(video.duration)) {
              durationEl.textContent = formatTime(video.duration);
            }
            saveProgress();
          });

          progressContainer.addEventListener('click', (e) => {
            const rect = progressContainer.getBoundingClientRect();
            const pos = (e.clientX - rect.left) / rect.width;
            video.currentTime = pos * video.duration;
          });

          // Volume
          volumeSlider.value = video.volume;
          volumeSlider.addEventListener('input', (e) => {
            video.volume = e.target.value;
            video.muted = false;
            updateVolumeIcon();
          });

          muteBtn.addEventListener('click', () => {
            video.muted = !video.muted;
            updateVolumeIcon();
          });

          function updateVolumeIcon() {
            if (video.muted || video.volume === 0) {
              volumeIcon.setAttribute('data-lucide', 'volume-x');
            } else if (video.volume < 0.5) {
              volumeIcon.setAttribute('data-lucide', 'volume-1');
            } else {
              volumeIcon.setAttribute('data-lucide', 'volume-2');
            }
            if (window.lucide) window.lucide.createIcons();
          }

          // Fullscreen
          fullscreenBtn.addEventListener('click', () => {
            if (!document.fullscreenElement) {
              wrapper.requestFullscreen().catch(err => {
                console.log('Error attempting to enable fullscreen:', err);
              });
            } else {
              document.exitFullscreen();
            }
          });

          // Settings Modal
          settingsBtn.addEventListener('click', () => {
              settingsModal.classList.add('active');
          });

          closeSettingsBtn.addEventListener('click', () => {
              settingsModal.classList.remove('active');
          });

          // Next Source Logic
          nextSourceBtn.addEventListener('click', async () => {
              const originalHtml = nextSourceBtn.innerHTML;
              nextSourceBtn.innerHTML = '<div class="spinner" style="width: 16px; height: 16px; border-width: 2px;"></div>';
              nextSourceBtn.disabled = true;

              try {
                  const fetchId = meta.imdb_id || meta.id;
                  let url = \`/api/streaming/streams/\${meta.type}/\${fetchId}?profileId=\${profileId}\`;
                  if (meta.type === 'series' && meta.season && meta.episode) {
                    url += \`&season=\${meta.season}&episode=\${meta.episode}\`;
                  }
                  
                  const res = await fetch(url);
                  const data = await res.json();
                  
                  if (data.streams && data.streams.length > 0) {
                      // Flatten streams
                      const allStreams = data.streams.flatMap(g => g.streams);
                      // Find current stream index
                      const currentIdx = allStreams.findIndex(s => s.url === streamUrl);
                      // Get next stream
                      const nextStream = allStreams[currentIdx + 1] || allStreams[0];
                      
                      if (nextStream && nextStream.url !== streamUrl) {
                          window.location.replace(\`/streaming/\${profileId}/player?stream=\${encodeURIComponent(JSON.stringify(nextStream))}&meta=\${encodeURIComponent(JSON.stringify(meta))}\`);
                      } else {
                          alert('No other sources available');
                      }
                  } else {
                      alert('No streams found');
                  }
              } catch (e) {
                  console.error(e);
                  alert('Error finding streams');
              } finally {
                  nextSourceBtn.innerHTML = originalHtml;
                  nextSourceBtn.disabled = false;
                  if (window.lucide) window.lucide.createIcons();
              }
          });

          // Auto-hide controls
          let hideTimeout;
          function showControls() {
            wrapper.classList.add('active');
            clearTimeout(hideTimeout);
            hideTimeout = setTimeout(() => {
              if (!video.paused && !settingsModal.classList.contains('active')) {
                wrapper.classList.remove('active');
              }
            }, 3000);
          }

          wrapper.addEventListener('mousemove', showControls);
          wrapper.addEventListener('click', (e) => {
              if (!settingsModal.contains(e.target) && e.target !== settingsBtn && !settingsBtn.contains(e.target)) {
                  showControls();
              }
          });

          // Progress Saving
          let lastUpdate = 0;
          function saveProgress() {
            const now = Date.now();
            if (now - lastUpdate < 5000) return;
            lastUpdate = now;
            
            fetch('/api/streaming/progress', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                profileId,
                metaId: meta.id,
                metaType: meta.type,
                title: meta.name,
                poster: meta.poster,
                duration: video.duration,
                position: video.currentTime
              })
            }).catch(console.error);
          }
          
          // Initial setup
          if (window.lucide) window.lucide.createIcons();
          showControls();

        })();
      `}} />
    </Layout>
  )
}