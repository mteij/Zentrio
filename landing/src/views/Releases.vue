<template>
  <div class="releases-view">
    <div class="container">
      <header class="page-header">
        <h1 class="page-title">Releases</h1>
        <p class="page-subtitle">Download the latest version of Zentrio for your device.</p>
      </header>

      <div v-if="loading" class="loading-state">
        <div class="spinner"></div>
        <p>Loading releases...</p>
      </div>

      <div v-else-if="error" class="error-state">
        <p>{{ error }}</p>
        <button @click="fetchReleases" class="btn btn-secondary">Try Again</button>
      </div>

      <div v-else class="releases-list">
        <div v-for="(release, index) in releases" :key="release.id" class="release-card" :class="{ latest: index === 0 }">
          <div class="release-header">
            <div class="version-info">
              <span v-if="index === 0" class="latest-badge">Latest</span>
              <h2>{{ release.tag_name }}</h2>
              <span class="release-date">{{ formatDate(release.published_at) }}</span>
            </div>
            <a :href="release.html_url" target="_blank" class="github-link">
              View on GitHub ↗
            </a>
          </div>

          <div class="release-notes" v-html="renderMarkdown(release.body)"></div>

          <div class="downloads-grid">
            <div class="platform-group">
              <h4>Mobile</h4>
              <div class="btn-group">
                <a v-if="getAsset(release, 'android')" :href="getAsset(release, 'android').browser_download_url" class="btn btn-secondary btn-sm">
                  <span class="icon">🤖</span> Android (APK)
                </a>
                <span v-else class="btn btn-secondary btn-sm disabled">
                  <span class="icon">🤖</span> Android (Not available)
                </span>
                
                <a v-if="getAsset(release, 'ios')" :href="getAsset(release, 'ios').browser_download_url" class="btn btn-secondary btn-sm">
                  <span class="icon">🍎</span> iOS (IPA)
                </a>
                <span v-else class="btn btn-secondary btn-sm disabled">
                  <span class="icon">🍎</span> iOS (Not available)
                </span>
              </div>
            </div>

            <div class="platform-group">
              <h4>Desktop</h4>
              <div class="btn-group">
                <a v-if="getAsset(release, 'windows')" :href="getAsset(release, 'windows').browser_download_url" class="btn btn-secondary btn-sm">
                  <span class="icon">🪟</span> Windows (.exe)
                </a>
                <span v-else class="btn btn-secondary btn-sm disabled">
                  <span class="icon">🪟</span> Windows (Not available)
                </span>

                <a v-if="getAsset(release, 'mac')" :href="getAsset(release, 'mac').browser_download_url" class="btn btn-secondary btn-sm">
                  <span class="icon">🍎</span> macOS (.dmg)
                </a>
                <span v-else class="btn btn-secondary btn-sm disabled">
                  <span class="icon">🍎</span> macOS (Not available)
                </span>

                <a v-if="getAsset(release, 'linux')" :href="getAsset(release, 'linux').browser_download_url" class="btn btn-secondary btn-sm">
                  <span class="icon">🐧</span> Linux (.AppImage)
                </a>
                <span v-else class="btn btn-secondary btn-sm disabled">
                  <span class="icon">🐧</span> Linux (Not available)
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { marked } from 'marked'

export default {
  name: 'Releases',
  data() {
    return {
      releases: [],
      loading: true,
      error: null
    }
  },
  async created() {
    await this.fetchReleases()
  },
  methods: {
    async fetchReleases() {
      this.loading = true
      this.error = null
      try {
        const response = await fetch('https://api.github.com/repos/mteij/Zentrio/releases')
        if (!response.ok) throw new Error('Failed to fetch releases')
        this.releases = await response.json()
      } catch (err) {
        this.error = 'Unable to load releases. Please check your connection.'
        console.error(err)
      } finally {
        this.loading = false
      }
    },
    formatDate(dateString) {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    },
    renderMarkdown(text) {
      return marked(text || '')
    },
    getAsset(release, platform) {
      if (!release.assets) return null
      
      const patterns = {
        android: /\.apk$/i,
        ios: /\.ipa$/i,
        windows: /\.exe$/i,
        mac: /\.dmg$/i,
        linux: /\.AppImage$/i
      }
      
      return release.assets.find(asset => patterns[platform].test(asset.name))
    }
  }
}
</script>

<style scoped>
.releases-view {
  padding-top: 120px;
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

.loading-state, .error-state {
  text-align: center;
  padding: 60px;
  color: var(--text-muted);
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(255, 255, 255, 0.1);
  border-radius: 50%;
  border-top-color: var(--accent);
  animation: spin 1s ease-in-out infinite;
  margin: 0 auto 20px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
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
  color: var(--text-muted);
  line-height: 1.6;
}

.release-notes :deep(h1),
.release-notes :deep(h2),
.release-notes :deep(h3) {
  color: var(--text);
  margin-top: 24px;
  margin-bottom: 16px;
}

.release-notes :deep(ul),
.release-notes :deep(ol) {
  padding-left: 24px;
  margin-bottom: 16px;
}

.release-notes :deep(li) {
  margin-bottom: 8px;
}

.release-notes :deep(a) {
  color: var(--accent);
  text-decoration: none;
}

.release-notes :deep(a:hover) {
  text-decoration: underline;
}

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

.btn-sm.disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background: rgba(255, 255, 255, 0.02);
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