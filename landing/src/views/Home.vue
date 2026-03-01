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
              <img
                src="/app-screenshot.png"
                alt="Zentrio Web App Screenshot"
                class="app-screenshot-img"
              />
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

    <section class="community">
      <div class="container">
        <div class="community-grid">
          <div class="community-content fade-in-up">
            <h2 class="section-title" style="text-align: left">
              Open Source & Community
            </h2>
            <p
              class="section-subtitle"
              style="text-align: left; margin-bottom: 24px; font-size: 1.1rem"
            >
              Zentrio is completely open-source. We welcome contributions from
              everyone, whether it's fixing bugs, adding features, or improving
              documentation. Feel free to explore the repository!
            </p>
            <div class="community-actions">
              <a
                href="https://github.com/mteij/Zentrio"
                target="_blank"
                class="btn btn-secondary action-btn"
              >
                <Github class="btn-icon-svg" />
                Contribute on GitHub
              </a>
              <a
                href="https://buymeacoffee.com/michieleijpe"
                target="_blank"
                class="btn btn-primary action-btn shine-effect"
              >
                <Coffee class="btn-icon-svg" />
                Buy Me a Coffee
              </a>
            </div>
          </div>
          <div class="community-visual fade-in-up delay-1">
            <div class="star-history-container">
              <img
                src="https://api.star-history.com/svg?repos=mteij/Zentrio&type=Date&theme=dark"
                alt="Zentrio GitHub Star History"
                class="star-history-img"
              />
            </div>
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
  Github,
  Coffee,
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
  if (/Linux/.test(platform) || /Linux/.test(userAgent)) {
    if (/Ubuntu|Debian/i.test(userAgent)) return "linux-deb";
    if (/Fedora|Red Hat|CentOS|SUSE/i.test(userAgent)) return "linux-rpm";
    return "linux-appimage";
  }
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
    if (os.startsWith("linux")) {
      label = "Linux";
      icon = Terminal;
      if (os === "linux-deb") label = "Linux (.deb)";
      if (os === "linux-rpm") label = "Linux (.rpm)";
      if (os === "linux-appimage") label = "Linux (.AppImage)";
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

    // Use /releases?per_page=1 instead of /releases/latest because
    // GitHub's /releases/latest endpoint excludes pre-releases (0.x.x).
    const response = await fetch(
      "https://api.github.com/repos/mteij/Zentrio/releases?per_page=1",
    );
    if (!response.ok) return;

    const data = await response.json();
    const release = Array.isArray(data) ? data[0] : data;
    if (!release || !release.assets) return;

    const patterns = {
      android: /\.apk$/i,
      ios: /\.ipa$/i,
      windows: /\.exe$/i,
      mac: /\.dmg$/i,
      "linux-appimage": /\.AppImage$/i,
      "linux-deb": /\.deb$/i,
      "linux-rpm": /\.rpm$/i,
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
  // Defer non-critical API call to improve LCP
  // Use requestIdleCallback if available, otherwise setTimeout
  if ("requestIdleCallback" in window) {
    requestIdleCallback(() => fetchLatestReleaseAndSetDownload(), {
      timeout: 2000,
    });
  } else {
    setTimeout(fetchLatestReleaseAndSetDownload, 100);
  }
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
  background: var(--bg);
  position: relative;
  overflow: hidden;
}

.app-screenshot-img {
  width: 100%;
  height: auto;
  display: block;
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

/* Community Section */
.community {
  padding: 60px 0 120px;
  position: relative;
  z-index: 1;
}

.community-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 40px;
  align-items: center;
  background: var(--bg-alt);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 40px;
  transition:
    border-color 0.3s ease,
    transform 0.3s ease;
}

.community-grid:hover {
  border-color: var(--border-hover);
  transform: translateY(-5px);
}

.community-content {
  display: flex;
  flex-direction: column;
}

.community-actions {
  display: flex;
  gap: 16px;
  margin-top: 10px;
  flex-wrap: wrap;
}

.community-visual {
  display: flex;
  justify-content: center;
  align-items: center;
}

.star-history-container {
  width: 100%;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid var(--border);
  background: rgba(0, 0, 0, 0.2);
}

.star-history-img {
  width: 100%;
  height: auto;
  display: block;
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

  .community-grid {
    grid-template-columns: 1fr;
    padding: 24px;
    gap: 32px;
  }

  .browser-mockup {
    transform: none;
    border-radius: 8px 8px 0 0;
    border-bottom: none;
  }
  .browser-content {
    height: auto;
    padding: 0;
  }
}
</style>
