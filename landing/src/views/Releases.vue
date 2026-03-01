<template>
  <div class="releases-view">
    <div class="container">
      <header class="page-header">
        <h1 class="page-title">Downloads & Releases</h1>
        <p class="page-subtitle">
          Get Zentrio for your platform to enjoy the native experience.
        </p>
      </header>

      <!-- Top Section: Primary Downloads -->
      <section class="primary-downloads">
        <div v-if="loadingLatest" class="loading-latest">
          <div class="spinner"></div>
        </div>

        <div v-else-if="latestRelease" class="downloads-grid">
          <div class="platform-card">
            <Monitor class="platform-icon-svg" />
            <h3>Windows</h3>
            <p>Windows 10/11 (64-bit)</p>
            <a
              v-if="getAsset(latestRelease, 'windows')"
              :href="getAsset(latestRelease, 'windows').browser_download_url"
              class="btn btn-primary w-full mt-4"
            >
              Download .exe
            </a>
            <span v-else class="btn btn-secondary disabled w-full mt-4"
              >Not Available Yet</span
            >
          </div>

          <div class="platform-card">
            <Apple class="platform-icon-svg" />
            <h3>macOS</h3>
            <p>macOS 11.0 or later</p>
            <a
              v-if="getAsset(latestRelease, 'mac')"
              :href="getAsset(latestRelease, 'mac').browser_download_url"
              class="btn btn-primary w-full mt-4"
            >
              Download .dmg
            </a>
            <span v-else class="btn btn-secondary disabled w-full mt-4"
              >Not Available Yet</span
            >
          </div>

          <div class="platform-card">
            <Smartphone class="platform-icon-svg" />
            <h3>Android</h3>
            <p>Android 8.0 or later</p>
            <a
              v-if="getAsset(latestRelease, 'android')"
              :href="getAsset(latestRelease, 'android').browser_download_url"
              class="btn btn-primary w-full mt-4"
            >
              Download .apk
            </a>
            <span v-else class="btn btn-secondary disabled w-full mt-4"
              >Not Available Yet</span
            >
          </div>

          <div class="platform-card">
            <Terminal class="platform-icon-svg" />
            <h3>Linux</h3>
            <p>.deb / .rpm / AppImage</p>
            <div class="linux-downloads">
              <a
                v-if="getAsset(latestRelease, 'linux-deb')"
                :href="
                  getAsset(latestRelease, 'linux-deb').browser_download_url
                "
                class="btn btn-primary btn-sm mt-4 w-full"
              >
                Download .deb
              </a>
              <a
                v-if="getAsset(latestRelease, 'linux-rpm')"
                :href="
                  getAsset(latestRelease, 'linux-rpm').browser_download_url
                "
                class="btn btn-primary btn-sm mt-2 w-full"
              >
                Download .rpm
              </a>
              <a
                v-if="getAsset(latestRelease, 'linux-appimage')"
                :href="
                  getAsset(latestRelease, 'linux-appimage').browser_download_url
                "
                class="btn btn-primary btn-sm mt-2 w-full"
              >
                Download AppImage
              </a>
            </div>
            <span
              v-if="
                !getAsset(latestRelease, 'linux-deb') &&
                !getAsset(latestRelease, 'linux-rpm') &&
                !getAsset(latestRelease, 'linux-appimage')
              "
              class="btn btn-secondary disabled w-full mt-4"
              >Not Available Yet</span
            >

            <div class="install-script-container">
              <span class="install-script-label"
                >Or use the install script:</span
              >
              <code class="install-script-code"
                >curl -sL zentrio.eu/install.sh | bash</code
              >
            </div>
          </div>
        </div>
      </section>

      <section class="web-app-banner">
        <div class="banner-content">
          <h3>No installation required!</h3>
          <p>
            You can also access the fully featured Zentrio web application
            directly in your browser.
          </p>
        </div>
        <a href="https://app.zentrio.eu" class="btn btn-secondary"
          >Launch Zentrio Web</a
        >
      </section>

      <!-- Bottom Section: Changelog -->
      <section class="changelog-section">
        <div class="changelog-header-flex">
          <div>
            <h2 class="section-title">Changelog</h2>
            <p class="section-subtitle">See what's new in recent updates.</p>
          </div>

          <div
            v-if="!loading && !error && releases.length > 0"
            class="pagination-controls"
          >
            <span class="text-sm text-muted">Show:</span>
            <select v-model="itemsPerPage" class="items-select">
              <option :value="5">5</option>
              <option :value="10">10</option>
              <option :value="25">25</option>
              <option :value="50">50</option>
            </select>
            <span class="text-sm text-muted ml-2">per page</span>
          </div>
        </div>

        <div v-if="loading" class="loading-state">
          <div class="spinner"></div>
          <p>Loading releases history...</p>
        </div>

        <div v-else-if="error" class="error-state">
          <p>{{ error }}</p>
          <button @click="fetchReleases" class="btn btn-secondary mt-4">
            Try Again
          </button>
        </div>

        <div v-else class="releases-list">
          <div
            v-for="(release, index) in paginatedReleases"
            :key="release.id"
            class="release-entry"
          >
            <div class="release-sidebar">
              <div class="version-tag" :class="{ 'latest-tag': index === 0 }">
                {{ release.tag_name }}
              </div>
              <div class="release-date">
                {{ formatDate(release.published_at) }}
              </div>
            </div>
            <div class="release-content">
              <div class="release-header-flex">
                <h3>{{ release.name || release.tag_name }}</h3>
                <a :href="release.html_url" target="_blank" class="github-link"
                  >View on GitHub ↗</a
                >
              </div>
              <div
                class="markdown-body"
                v-html="renderMarkdown(release.body)"
              ></div>
            </div>
          </div>

          <!-- Pagination Buttons -->
          <div v-if="totalPages > 1" class="pagination-footer">
            <button
              @click="currentPage--"
              :disabled="currentPage === 1"
              class="btn btn-secondary btn-sm"
            >
              Previous
            </button>
            <span class="page-info"
              >Page {{ currentPage }} of {{ totalPages }}</span
            >
            <button
              @click="currentPage++"
              :disabled="currentPage >= totalPages"
              class="btn btn-secondary btn-sm"
            >
              Next
            </button>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { marked } from "marked";
import { Monitor, Apple, Smartphone, Terminal } from "lucide-vue-next";

const releases = ref([]);
const loading = ref(true);
const error = ref(null);

// Pagination
const currentPage = ref(1);
const itemsPerPage = ref(10);

const latestRelease = computed(() => {
  return releases.value.length > 0 ? releases.value[0] : null;
});
const loadingLatest = computed(() => loading.value);

const totalPages = computed(() =>
  Math.ceil(releases.value.length / itemsPerPage.value),
);

const paginatedReleases = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value;
  const end = start + itemsPerPage.value;
  return releases.value.slice(start, end);
});

// Reset to page 1 if user changes the items per page
import { watch } from "vue";
watch(itemsPerPage, () => {
  currentPage.value = 1;
});

const fetchReleases = async () => {
  loading.value = true;
  error.value = null;

  try {
    const response = await fetch(
      "https://api.github.com/repos/mteij/Zentrio/releases",
    );
    if (!response.ok) throw new Error("Failed to fetch releases");
    const data = await response.json();
    releases.value = data;
  } catch (err) {
    error.value = "Unable to load releases. Please check your connection.";
    console.error(err);
  } finally {
    loading.value = false;
  }
};

const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const renderMarkdown = (text) => {
  if (!text) return "";

  let filteredText = text
    .split("**Links:**")[0]
    .split("## Links:")[0]
    .split("### Links:")[0]
    .split("Links:")[0];

  filteredText = filteredText.trim();

  if (filteredText.endsWith("---")) {
    filteredText = filteredText.slice(0, -3).trim();
  }

  return marked(filteredText);
};

const getAsset = (release, platform) => {
  if (!release || !release.assets) return null;

  const patterns = {
    android: /\.apk$/i,
    ios: /\.ipa$/i,
    windows: /\.exe$/i,
    mac: /\.dmg$/i,
    "linux-deb": /\.deb$/i,
    "linux-rpm": /\.rpm$/i,
    "linux-appimage": /\.AppImage$/i,
  };

  return release.assets.find((asset) => patterns[platform].test(asset.name));
};

onMounted(() => {
  fetchReleases();
});
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
  font-size: 3.5rem;
  font-weight: 800;
  margin-bottom: 16px;
  letter-spacing: -0.03em;
}

.page-subtitle {
  color: var(--text-muted);
  font-size: 1.2rem;
}

/* Primary Downloads Section */
.primary-downloads {
  margin-bottom: 40px;
}

.downloads-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 24px;
}

.platform-card {
  background: var(--bg-alt);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 32px 24px;
  text-align: center;
  transition:
    transform 0.3s ease,
    border-color 0.3s ease;
}

.platform-card:hover {
  transform: translateY(-4px);
  border-color: var(--border-hover);
}

.platform-icon-svg {
  width: 48px;
  height: 48px;
  margin-bottom: 16px;
  color: var(--text);
  opacity: 0.9;
}

.platform-card h3 {
  font-size: 1.25rem;
  margin-bottom: 4px;
}

.platform-card p {
  color: var(--text-muted);
  font-size: 0.9rem;
  margin-bottom: 16px;
}

.w-full {
  width: 100%;
}

.mt-4 {
  margin-top: 16px;
}

.install-script-container {
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.install-script-label {
  font-size: 0.8rem;
  color: var(--text-muted);
}

.install-script-code {
  background: rgba(0, 0, 0, 0.4);
  padding: 8px;
  border-radius: 6px;
  font-size: 0.75rem;
  color: #a0a0a5;
  border: 1px solid var(--border);
  user-select: all;
  word-break: break-all;
}

.linux-downloads {
  display: flex;
  flex-direction: column;
  width: 100%;
  gap: 8px; /* Added gap to prevent buttons from colliding */
}

.linux-downloads .btn {
  margin-top: 0 !important; /* Override the inline mt-4 and mt-2 */
}

.btn-sm {
  padding: 6px 12px;
  font-size: 0.9rem;
}

.btn.disabled {
  opacity: 0.5;
  pointer-events: none;
}

/* Web App Banner */
.web-app-banner {
  background: linear-gradient(
    135deg,
    rgba(229, 9, 20, 0.1) 0%,
    rgba(20, 20, 23, 0.4) 100%
  );
  border: 1px solid var(--accent);
  border-radius: 16px;
  padding: 32px 40px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 80px;
}

.banner-content h3 {
  font-size: 1.4rem;
  margin-bottom: 8px;
}

.banner-content p {
  color: var(--text-muted);
}

.changelog-section {
  border-top: 1px solid var(--border);
  padding-top: 80px;
}

.changelog-header-flex {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 40px;
  flex-wrap: wrap;
  gap: 20px;
}

.section-title {
  font-size: 2.2rem;
  margin-bottom: 8px;
}

.section-subtitle {
  color: var(--text-muted);
  margin-bottom: 0px; /* Moved margin to the flex container */
}

.pagination-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--bg-alt);
  padding: 10px 16px;
  border-radius: 12px;
  border: 1px solid var(--border);
}

.items-select {
  background: var(--bg);
  border: 1px solid var(--border);
  color: var(--text);
  padding: 4px 8px;
  border-radius: 6px;
  outline: none;
  font-size: 0.9rem;
  cursor: pointer;
}

.items-select:focus {
  border-color: var(--accent);
}

.text-muted {
  color: var(--text-muted);
}

.ml-2 {
  margin-left: 8px;
}

.pagination-footer {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  margin-top: 40px;
  padding-top: 40px;
  border-top: 1px solid var(--border);
}

.page-info {
  color: var(--text-muted);
  font-size: 0.95rem;
  font-weight: 500;
}

.release-entry {
  display: flex;
  gap: 40px;
  margin-bottom: 60px;
}

.release-sidebar {
  width: 180px;
  flex-shrink: 0;
  position: relative;
}

.version-tag {
  display: inline-block;
  background: var(--bg-soft);
  border: 1px solid var(--border);
  padding: 6px 14px;
  border-radius: 100px;
  font-weight: 700;
  font-size: 1.1rem;
  margin-bottom: 8px;
}

.latest-tag {
  background: rgba(229, 9, 20, 0.15);
  border-color: rgba(229, 9, 20, 0.3);
  color: white;
}

.release-date {
  color: var(--text-dim);
  font-size: 0.9rem;
  padding-left: 8px;
}

.release-content {
  flex: 1;
  background: var(--bg-alt);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 40px;
}

.release-header-flex {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
  border-bottom: 1px solid var(--border);
  padding-bottom: 20px;
}

.release-header-flex h3 {
  font-size: 1.5rem;
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

/* Markdown Rendering Styles */
.markdown-body {
  color: var(--text-muted);
  font-size: 0.95rem;
}

.markdown-body :deep(h1),
.markdown-body :deep(h2),
.markdown-body :deep(h3) {
  color: var(--text);
  margin-top: 24px;
  margin-bottom: 16px;
  font-weight: 600;
}

.markdown-body :deep(ul),
.markdown-body :deep(ol) {
  padding-left: 20px;
  margin-bottom: 16px;
}

.markdown-body :deep(li) {
  margin-bottom: 6px;
}

.markdown-body :deep(a) {
  color: var(--accent);
  text-decoration: none;
}

.markdown-body :deep(a:hover) {
  text-decoration: underline;
}

.markdown-body :deep(strong) {
  color: var(--text);
}

.loading-state,
.error-state {
  text-align: center;
  padding: 80px 0;
  color: var(--text-muted);
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(255, 255, 255, 0.1);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 20px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 1024px) {
  .downloads-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .page-title {
    font-size: 2.8rem;
  }

  .web-app-banner {
    flex-direction: column;
    text-align: center;
    gap: 20px;
    padding: 32px 24px;
  }

  .release-entry {
    flex-direction: column;
    gap: 20px;
  }

  .release-sidebar {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .release-date {
    padding-left: 0;
    margin-bottom: 8px;
  }

  .release-content {
    padding: 24px;
  }

  .release-header-flex {
    flex-direction: column;
    gap: 8px;
  }
}

@media (max-width: 480px) {
  .downloads-grid {
    grid-template-columns: 1fr;
  }
}
</style>
