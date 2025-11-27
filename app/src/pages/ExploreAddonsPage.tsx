import { SimpleLayout } from '../components/index';

export function ExploreAddonsPage() {
  return (
    <SimpleLayout title="Explore Addons">
      <div id="zentrio-vanta-bg" style={{ position: 'fixed', inset: 0, zIndex: 0, width: '100vw', height: '100vh' }}></div>
      <div className="container" style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ paddingTop: '80px' }}>
          <button
            id="backButton"
            className="zentrio-back-btn"
            onClick={() => window.history.back()}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
            </svg>
            Back to Settings
          </button>
          <div className="settings-card">
            <h2 className="section-title">Explore Addons</h2>
            <div id="exploreAddonsList" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
              {/* Addons will be loaded here */}
            </div>
          </div>
        </div>
      </div>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r134/three.min.js"></script>
      <script src="https://cdn.jsdelivr.net/npm/vanta@latest/dist/vanta.fog.min.js"></script>
      <script src="/static/js/theme.js"></script>
      <script src="/static/js/explore-addons.js"></script>
    </SimpleLayout>
  );
}