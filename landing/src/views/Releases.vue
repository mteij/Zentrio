<template>
  <div class="releases-view">
    <div class="container">
      <header class="page-header">
        <h1 class="page-title">Releases</h1>
        <p class="page-subtitle">Download the latest version of Zentrio for your device.</p>
      </header>

      <div class="releases-list">
        <!-- Latest Release -->
        <div class="release-card latest">
          <div class="release-header">
            <div class="version-info">
              <span class="latest-badge">Latest</span>
              <h2>v1.0.0</h2>
              <span class="release-date">November 30, 2025</span>
            </div>
            <a href="https://github.com/MichielEijpe/Zentrio/releases/tag/v1.0.0" target="_blank" class="github-link">
              View on GitHub ↗
            </a>
          </div>

          <div class="release-notes">
            <h3>Initial Release</h3>
            <ul>
              <li>🚀 First public release of Zentrio</li>
              <li>👥 Multi-profile support with separate watch histories</li>
              <li>🎨 Modern glassmorphic interface</li>
              <li>🧩 Stremio addon support</li>
              <li>🔄 Cross-device synchronization</li>
            </ul>
          </div>

          <div class="downloads-grid">
            <div class="platform-group">
              <h4>Mobile</h4>
              <div class="btn-group">
                <a href="#" class="btn btn-secondary btn-sm">
                  <span class="icon">🤖</span> Android (APK)
                </a>
                <a href="#" class="btn btn-secondary btn-sm">
                  <span class="icon">🍎</span> iOS (IPA)
                </a>
              </div>
            </div>

            <div class="platform-group">
              <h4>Desktop</h4>
              <div class="btn-group">
                <a href="#" class="btn btn-secondary btn-sm">
                  <span class="icon">🪟</span> Windows (.exe)
                </a>
                <a href="#" class="btn btn-secondary btn-sm">
                  <span class="icon">🍎</span> macOS (.dmg)
                </a>
                <a href="#" class="btn btn-secondary btn-sm">
                  <span class="icon">🐧</span> Linux (.AppImage)
                </a>
              </div>
            </div>
          </div>
        </div>

        <!-- Older releases can be added here -->
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'Releases'
}
</script>

<style scoped>
.releases-view {
  padding-top: 120px; /* Account for fixed navbar */
  padding-bottom: 80px;
  min-height: 100vh;
}

.page-header {
  text-align: center;
  margin-bottom: 60px;
}

.page-title {
  font-size: 3rem;
  font-weight: 800;
  margin-bottom: 16px;
  background: linear-gradient(135deg, #ffffff 0%, #e50914 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.page-subtitle {
  color: var(--text-muted);
  font-size: 1.2rem;
}

.release-card {
  background: var(--card-bg);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid var(--card-border);
  border-radius: 24px;
  padding: 40px;
  margin-bottom: 40px;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.release-card:hover {
  border-color: rgba(255, 255, 255, 0.2);
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3);
}

.release-card.latest {
  border-color: rgba(229, 9, 20, 0.3);
  background: linear-gradient(180deg, rgba(229, 9, 20, 0.05) 0%, rgba(255, 255, 255, 0.02) 100%);
}

.release-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 30px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  padding-bottom: 20px;
}

.version-info {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.version-info h2 {
  font-size: 2rem;
  font-weight: 700;
}

.latest-badge {
  background: var(--accent);
  color: white;
  padding: 4px 12px;
  border-radius: 100px;
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.release-date {
  color: var(--text-muted);
  font-size: 0.9rem;
}

.github-link {
  color: var(--text-muted);
  text-decoration: none;
  font-size: 0.9rem;
  transition: color 0.2s;
}

.github-link:hover {
  color: white;
}

.release-notes {
  margin-bottom: 40px;
}

.release-notes h3 {
  font-size: 1.2rem;
  margin-bottom: 16px;
  color: var(--text);
}

.release-notes ul {
  list-style: none;
  padding: 0;
}

.release-notes li {
  color: var(--text-muted);
  margin-bottom: 8px;
  padding-left: 24px;
  position: relative;
}

/* Downloads Grid */
.downloads-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 40px;
}

.platform-group h4 {
  color: var(--text-muted);
  font-size: 0.9rem;
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 16px;
}

.btn-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.btn-sm {
  padding: 10px 20px;
  font-size: 0.95rem;
  justify-content: flex-start;
  width: 100%;
}

.icon {
  margin-right: 12px;
  font-size: 1.2em;
}

@media (max-width: 768px) {
  .release-header {
    flex-direction: column;
    gap: 16px;
  }
  
  .version-info {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  
  .downloads-grid {
    grid-template-columns: 1fr;
    gap: 30px;
  }
}
</style>