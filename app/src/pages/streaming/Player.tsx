import { Layout } from '../../components/Layout'
import { Stream } from '../../services/addons/types'

interface StreamingPlayerProps {
  stream: Stream
  meta: { id: string, type: string, name: string, poster?: string }
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
        >
          Your browser does not support the video tag.
        </video>

        <div className="player-overlay" id="playerOverlay">
          <div className="player-top-bar">
            <a href="javascript:history.back()" className="zentrio-back-btn" style={{ position: 'static', transform: 'none', margin: 0 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
              </svg>
              Back
            </a>
            <div className="stream-info">
              <div className="stream-title">{meta.name}</div>
              <div className="stream-subtitle">{stream.title || stream.name || 'Playing'}</div>
            </div>
            <div style={{ width: 40 }}></div> {/* Spacer for centering */}
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
                  <i data-lucide="pause" id="playIcon" style={{ width: 24, height: 24, fill: 'currentColor' }}></i>
                </button>
                
                <div className="volume-wrapper">
                  <div className="volume-container">
                    <input type="range" min="0" max="1" step="0.1" className="volume-slider" id="volumeSlider" />
                  </div>
                  <button className="control-btn" id="muteBtn">
                    <i data-lucide="volume-2" id="volumeIcon" style={{ width: 24, height: 24 }}></i>
                  </button>
                </div>

                <div className="time-display">
                  <span id="currentTime">0:00</span> / <span id="duration">0:00</span>
                </div>
              </div>

              <div className="right-controls">
                <button className="control-btn" id="fullscreenBtn">
                  <i data-lucide="maximize" style={{ width: 24, height: 24 }}></i>
                </button>
              </div>
            </div>
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
          const playIcon = document.getElementById('playIcon');
          const progressBar = document.getElementById('progressBar');
          const progressContainer = document.getElementById('progressContainer');
          const volumeSlider = document.getElementById('volumeSlider');
          const muteBtn = document.getElementById('muteBtn');
          const volumeIcon = document.getElementById('volumeIcon');
          const fullscreenBtn = document.getElementById('fullscreenBtn');
          const currentTimeEl = document.getElementById('currentTime');
          const durationEl = document.getElementById('duration');
          const loadingSpinner = document.getElementById('playerLoading');

          const streamUrl = "${stream.url}";
          const profileId = ${profileId};
          const meta = ${JSON.stringify(meta)};
          
          // --- Platform Detection & Player Setup ---
          
          // Simple check for Capacitor environment (window.Capacitor is injected)
          const isNative = window.Capacitor && window.Capacitor.isNativePlatform();
          
          if (isNative) {
            // Native: Use Capacitor Video Player Plugin (or fallback to simple video tag if plugin not present)
            // For this implementation, we'll assume the native video element handles HLS/Dash via OS support
            // or we'd use a specific plugin call here.
            // Android/iOS webviews often support HLS natively.
            video.src = streamUrl;
            console.log('Native platform detected, using native playback capabilities');
          } else {
            // Web: Use HLS.js or Dash.js if needed
            const isHls = streamUrl.includes('.m3u8');
            const isDash = streamUrl.includes('.mpd');

            if (isHls && Hls.isSupported()) {
              const hls = new Hls();
              hls.loadSource(streamUrl);
              hls.attachMedia(video);
              hls.on(Hls.Events.MANIFEST_PARSED, function() {
                video.play().catch(e => console.log('Autoplay blocked', e));
              });
            } else if (isDash && typeof dashjs !== 'undefined') {
              const player = dashjs.MediaPlayer().create();
              player.initialize(video, streamUrl, true);
            } else {
              // Fallback for native support (Safari HLS, or direct MP4)
              video.src = streamUrl;
            }
          }

          // --- UI Logic ---

          function formatTime(seconds) {
            const m = Math.floor(seconds / 60);
            const s = Math.floor(seconds % 60);
            return m + ':' + (s < 10 ? '0' : '') + s;
          }

          function updatePlayIcon() {
            if (video.paused) {
              playIcon.setAttribute('data-lucide', 'play');
              wrapper.classList.add('paused');
            } else {
              playIcon.setAttribute('data-lucide', 'pause');
              wrapper.classList.remove('paused');
            }
            if (window.lucide) window.lucide.createIcons();
          }

          playPauseBtn.addEventListener('click', () => {
            if (video.paused) video.play();
            else video.pause();
          });

          video.addEventListener('play', updatePlayIcon);
          video.addEventListener('pause', updatePlayIcon);
          
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

          // Auto-hide controls
          let hideTimeout;
          function showControls() {
            wrapper.classList.add('active');
            clearTimeout(hideTimeout);
            hideTimeout = setTimeout(() => {
              if (!video.paused) {
                wrapper.classList.remove('active');
              }
            }, 3000);
          }

          wrapper.addEventListener('mousemove', showControls);
          wrapper.addEventListener('click', showControls);

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