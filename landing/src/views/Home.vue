<template>
  <div class="home-view">
    <header class="hero">
      <div class="container">
        <div class="hero-content">
          <h1 class="hero-title fade-in-up">
            <span class="text-gradient">Stream Your Way</span>
          </h1>

          <p class="hero-subtitle fade-in-up delay-1">
            Zentrio is a modern, self-hosted streaming platform. Manage multiple
            profiles, sync states across devices, and seamlessly install
            Stremio-compatible addons for infinite content.
          </p>

          <div class="hero-actions fade-in-up delay-2">
            <div class="action-column">
              <a
                href="https://app.zentrio.eu"
                class="btn btn-primary btn-lg shine-effect action-btn"
              >
                <Globe class="btn-icon-svg" />
                Launch Zentrio Web
              </a>
              <!-- Invisible spacer to match the right column's sub-link typography space -->
              <span class="sub-link spacer-text" aria-hidden="true"
                >&nbsp;</span
              >
            </div>

            <div class="action-column download-container">
              <a
                v-if="primaryDownload.isExternal"
                :href="primaryDownload.url"
                class="btn btn-secondary btn-lg action-btn"
              >
                <component :is="primaryDownload.icon" class="btn-icon-svg" />
                {{ primaryDownload.label }} Download
              </a>
              <router-link
                v-else
                to="/releases"
                class="btn btn-secondary btn-lg action-btn"
              >
                <Download
                  v-if="primaryDownload.icon === 'Download'"
                  class="btn-icon-svg"
                />
                <component
                  v-else
                  :is="primaryDownload.icon"
                  class="btn-icon-svg"
                />
                {{
                  primaryDownload.label === "Releases"
                    ? "Releases"
                    : `${primaryDownload.label} Download`
                }}
              </router-link>
              <router-link to="/releases" class="sub-link">
                or view all platforms
              </router-link>
            </div>
          </div>
        </div>

        <!-- Optional visual placeholder for the app interface -->
        <div class="hero-visual fade-in-up delay-3">
          <div class="browser-mockup">
            <div class="browser-top">
              <div class="dots"><span></span><span></span><span></span></div>
              <div class="url-bar">app.zentrio.eu</div>
            </div>
            <div class="browser-content">
              <div class="app-mockup">
                <div class="app-sidebar">
                  <div class="app-logo-mock"></div>
                  <div class="app-nav-item active"></div>
                  <div class="app-nav-item"></div>
                  <div class="app-nav-item"></div>
                  <div class="app-nav-item"></div>
                </div>
                <div class="app-main">
                  <div class="app-hero-mock">
                    <div class="app-hero-content-mock">
                      <div class="app-hero-title-mock"></div>
                      <div class="app-hero-desc-mock"></div>
                      <div class="app-hero-desc-mock short"></div>
                      <div class="app-hero-buttons-mock">
                        <div class="app-btn-play-mock"></div>
                        <div class="app-btn-more-mock"></div>
                      </div>
                    </div>
                  </div>
                  <div class="app-rows-mock">
                    <div class="app-row-mock">
                      <div class="app-row-title-mock"></div>
                      <div class="app-row-cards-mock">
                        <div
                          class="app-card-mock"
                          v-for="n in 6"
                          :key="'r1' + n"
                        ></div>
                      </div>
                    </div>
                    <div class="app-row-mock">
                      <div class="app-row-title-mock"></div>
                      <div class="app-row-cards-mock">
                        <div
                          class="app-card-mock"
                          v-for="n in 6"
                          :key="'r2' + n"
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>

    <main class="platform-stats">
      <div class="container">
        <div class="section-header">
          <h2 class="section-title">Platform Activity</h2>
          <p class="section-subtitle">
            Live statistics from the public Zentrio instance.
          </p>
        </div>

        <LiveStats />
      </div>
    </main>

    <section class="features">
      <div class="container">
        <div class="features-grid">
          <div class="feature-card">
            <div class="feature-icon">⚡</div>
            <h3>Modern Tech Stack</h3>
            <p>
              Engineered with modern technologies like Bun, Hono, and Tauri for
              a buttery smooth, native-like experience on all devices.
            </p>
          </div>
          <div class="feature-card">
            <div class="feature-icon">🧩</div>
            <h3>Addon System</h3>
            <p>
              Extend the platform instantly with community-built,
              Stremio-compatible addons to scrape and stream media.
            </p>
          </div>
          <div class="feature-card">
            <div class="feature-icon">🤖</div>
            <h3>Built with AI</h3>
            <p>
              Zentrio is an experimental project built with substantial
              assistance from AI tooling. Fast iteration, unique codebase.
            </p>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import LiveStats from "../components/LiveStats.vue";
import {
  Globe,
  Download,
  Monitor,
  Apple,
  Smartphone,
  Terminal,
} from "lucide-vue-next";

const primaryDownload = ref({
  url: "/releases",
  label: "Releases",
  icon: Download,
  isExternal: false,
});

const detectOS = () => {
  const userAgent = window.navigator.userAgent;
  const platform = window.navigator.platform;
  const macosPlatforms = ["Macintosh", "MacIntel", "MacPPC", "Mac68K"];
  const windowsPlatforms = ["Win32", "Win64", "Windows", "WinCE"];
  const iosPlatforms = ["iPhone", "iPad", "iPod"];

  if (macosPlatforms.indexOf(platform) !== -1 || userAgent.includes("Mac"))
    return "mac";
  if (windowsPlatforms.indexOf(platform) !== -1 || userAgent.includes("Win"))
    return "windows";
  if (iosPlatforms.indexOf(platform) !== -1 || userAgent.includes("iPhone"))
    return "ios";
  if (/Android/.test(userAgent)) return "android";
  if (/Linux/.test(platform)) return "linux";
  return null;
};

const fetchLatestReleaseAndSetDownload = async () => {
  try {
    const os = detectOS();
    if (!os) return;

    let label = "Releases";
    let icon = Download;

    if (os === "windows") {
      label = "Windows";
      icon = Monitor;
    }
    if (os === "mac") {
      label = "macOS";
      icon = Apple;
    }
    if (os === "android") {
      label = "Android";
      icon = Smartphone;
    }
    if (os === "linux") {
      label = "Linux";
      icon = Terminal;
    }
    if (os === "ios") {
      label = "iOS";
      icon = Apple;
    }

    primaryDownload.value = {
      url: "/releases",
      label,
      icon,
      isExternal: false,
    };

    const response = await fetch(
      "https://api.github.com/repos/mteij/Zentrio/releases/latest",
    );
    if (!response.ok) return;

    const release = await response.json();
    if (!release.assets) return;

    const patterns = {
      android: /\.apk$/i,
      ios: /\.ipa$/i,
      windows: /\.exe$/i,
      mac: /\.dmg$/i,
      linux: /\.(AppImage|deb)$/i,
    };

    if (patterns[os]) {
      const asset = release.assets.find((a) => patterns[os].test(a.name));
      if (asset) {
        primaryDownload.value = {
          url: asset.browser_download_url,
          label,
          icon,
          isExternal: true,
        };
      }
    }
  } catch (e) {
    console.error("Failed to fetch native download:", e);
  }
};

onMounted(() => {
  fetchLatestReleaseAndSetDownload();
});
</script>

<style scoped>
.home-view {
  position: relative;
  overflow: hidden;
  padding-top: 40px;
}

.hero {
  position: relative;
  z-index: 1;
  padding: 80px 0 60px;
  text-align: center;
}

.hero-content {
  max-width: 900px;
  margin: 0 auto 60px;
}

.hero-title {
  font-size: 4.5rem;
  font-weight: 800;
  line-height: 1.05;
  margin-bottom: 24px;
  letter-spacing: -0.03em;
  color: var(--text);
}

.text-gradient {
  background: linear-gradient(135deg, #ffffff 0%, var(--accent) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.hero-subtitle {
  font-size: 1.25rem;
  color: var(--text-muted);
  margin-bottom: 48px;
  max-width: 650px;
  margin-left: auto;
  margin-right: auto;
  line-height: 1.6;
}

.hero-actions {
  display: flex;
  gap: 20px;
  justify-content: center;
  flex-wrap: wrap;
}

.action-column {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.action-btn {
  min-width: 260px; /* Base width */
  width: auto; /* Allow to expand if needed */
  padding-left: 36px;
  padding-right: 36px;
  justify-content: center;
  white-space: nowrap; /* Prevent text from wrapping */
}

.btn-icon-svg {
  width: 20px;
  height: 20px;
  margin-right: 8px;
}

.download-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.sub-link {
  font-size: 0.85rem;
  color: var(--text-muted);
  text-decoration: none;
  transition: color 0.2s;
}

.sub-link:hover {
  color: var(--text);
  text-decoration: underline;
}

.spacer-text {
  visibility: hidden;
  user-select: none;
}

.shine-effect {
  position: relative;
  overflow: hidden;
}

.shine-effect::after {
  content: "";
  position: absolute;
  top: 0;
  left: -100%;
  width: 50%;
  height: 100%;
  background: linear-gradient(
    to right,
    rgba(255, 255, 255, 0) 0%,
    rgba(255, 255, 255, 0.2) 50%,
    rgba(255, 255, 255, 0) 100%
  );
  transform: skewX(-25deg);
  animation: shine 6s infinite;
}

@keyframes shine {
  0% {
    left: -100%;
  }
  20% {
    left: 200%;
  }
  100% {
    left: 200%;
  }
}

/* Browser Mockup */
.hero-visual {
  max-width: 1000px;
  margin: 0 auto;
  perspective: 1000px;
}

.browser-mockup {
  background: var(--bg-alt);
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow: hidden;
  box-shadow:
    0 30px 60px rgba(0, 0, 0, 0.4),
    0 0 100px rgba(229, 9, 20, 0.1);
  transform: rotateX(5deg);
  transition: transform 0.5s ease;
}

.browser-mockup:hover {
  transform: rotateX(0deg);
}

.browser-top {
  background: rgba(0, 0, 0, 0.4);
  padding: 12px 16px;
  display: flex;
  align-items: center;
  border-bottom: 1px solid var(--border);
}

.dots {
  display: flex;
  gap: 8px;
}

.dots span {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
}

.dots span:nth-child(1) {
  background: #ff5f56;
}
.dots span:nth-child(2) {
  background: #ffbd2e;
}
.dots span:nth-child(3) {
  background: #27c93f;
}

.url-bar {
  flex: 1;
  background: rgba(255, 255, 255, 0.05);
  margin-left: 20px;
  margin-right: 40px;
  border-radius: 6px;
  padding: 6px 0;
  font-size: 0.85rem;
  color: var(--text-muted);
  text-align: center;
}

.browser-content {
  height: 600px;
  background: var(--bg);
  position: relative;
  overflow: hidden;
}

/* App Mockup UI */
.app-mockup {
  display: flex;
  height: 100%;
  background: #09090b; /* Deep dark native background */
  width: 100%;
}

.app-sidebar {
  width: 72px;
  background: rgba(255, 255, 255, 0.02);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px 0;
  gap: 28px;
  flex-shrink: 0;
}

.app-logo-mock {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: var(--accent);
  margin-bottom: 24px;
}

.app-nav-item {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.1);
}

.app-nav-item.active {
  background: rgba(255, 255, 255, 0.9);
}

.app-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.app-hero-mock {
  height: 40%;
  background:
    linear-gradient(to right, rgba(9, 9, 11, 1) 5%, rgba(9, 9, 11, 0) 70%),
    linear-gradient(45deg, rgba(229, 9, 20, 0.15), transparent);
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: flex-end;
  padding: 40px 48px;
  position: relative;
  flex-shrink: 0;
}

.app-hero-content-mock {
  width: 70%;
}

.app-hero-title-mock {
  width: 60%;
  height: 36px;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 6px;
  margin-bottom: 16px;
}

.app-hero-desc-mock {
  width: 85%;
  height: 12px;
  background: rgba(255, 255, 255, 0.4);
  border-radius: 4px;
  margin-bottom: 10px;
}

.app-hero-desc-mock.short {
  width: 50%;
  margin-bottom: 24px;
}

.app-hero-buttons-mock {
  display: flex;
  gap: 16px;
}

.app-btn-play-mock {
  width: 120px;
  height: 40px;
  border-radius: 8px;
  background: var(--text);
}

.app-btn-more-mock {
  width: 140px;
  height: 40px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.15);
}

.app-rows-mock {
  flex: 1;
  padding: 32px 48px;
  display: flex;
  flex-direction: column;
  gap: 40px;
}

.app-row-mock {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.app-row-title-mock {
  width: 160px;
  height: 20px;
  background: rgba(255, 255, 255, 0.7);
  border-radius: 4px;
}

.app-row-cards-mock {
  display: flex;
  gap: 20px;
  overflow: hidden;
}

.app-card-mock {
  min-width: 140px;
  height: 210px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  border: 1px solid var(--border);
  position: relative;
  overflow: hidden;
}

.app-card-mock::after {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(180deg, transparent 50%, rgba(0, 0, 0, 0.6) 100%);
}

/* Stats Section */
.platform-stats {
  padding: 100px 0;
  position: relative;
  z-index: 1;
  background: linear-gradient(
    180deg,
    transparent 0%,
    rgba(20, 20, 23, 0.5) 100%
  );
}

.section-header {
  text-align: center;
  margin-bottom: 50px;
}

.section-title {
  font-size: 2.5rem;
  font-weight: 700;
  margin-bottom: 12px;
}

.section-subtitle {
  color: var(--text-muted);
  font-size: 1.15rem;
}

/* Features Section */
.features {
  padding: 60px 0 120px;
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 30px;
}

.feature-card {
  background: var(--bg-alt);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 40px 32px;
  transition:
    transform 0.3s ease,
    border-color 0.3s ease;
}

.feature-card:hover {
  transform: translateY(-5px);
  border-color: var(--border-hover);
}

.feature-icon {
  font-size: 2.5rem;
  margin-bottom: 24px;
}

.feature-card h3 {
  font-size: 1.3rem;
  margin-bottom: 12px;
  color: var(--text);
}

.feature-card p {
  color: var(--text-muted);
  font-size: 1rem;
  line-height: 1.6;
}

/* Animations */
.fade-in-up {
  opacity: 0;
  animation: fadeInUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

.delay-1 {
  animation-delay: 0.15s;
}
.delay-2 {
  animation-delay: 0.3s;
}
.delay-3 {
  animation-delay: 0.45s;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 1024px) {
  .hero-title {
    font-size: 3.5rem;
  }
  .features-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .hero-title {
    font-size: 2.8rem;
  }
  .hero-subtitle {
    font-size: 1.1rem;
    padding: 0 16px;
  }
  .hero-actions {
    flex-direction: column;
    padding: 0 24px;
  }
  .btn {
    width: 100%;
  }

  .features-grid {
    grid-template-columns: 1fr;
  }
  .browser-mockup {
    transform: none;
    border-radius: 8px 8px 0 0;
    border-bottom: none;
  }
  .browser-content {
    height: 400px;
    padding: 0;
  }

  .app-sidebar {
    display: none;
  }

  .app-hero-mock {
    height: 180px;
    padding: 24px;
  }

  .app-rows-mock {
    padding: 24px;
    gap: 24px;
  }

  .app-card-mock {
    min-width: 110px;
    height: 165px;
  }
}
</style>
