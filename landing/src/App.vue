<template>
  <div class="landing-page" :class="{ light: !isDark }">
    <div class="background-effect"></div>

    <nav class="navbar" :class="{ scrolled: isScrolled }">
      <div class="container nav-content">
        <router-link to="/" class="logo-area">
          <img src="/icon-512.png" alt="Zentrio" class="nav-logo" />
          <span class="nav-title">Zentrio</span>
        </router-link>
        <div class="nav-links">
          <router-link to="/releases" class="nav-link">Releases</router-link>
          <a href="https://docs.zentrio.eu" class="nav-link">Documentation</a>

          <div class="nav-actions">
            <a
              href="https://github.com/mteij/Zentrio"
              target="_blank"
              class="icon-btn"
              aria-label="GitHub"
            >
              <svg
                viewBox="0 0 24 24"
                width="20"
                height="20"
                fill="currentColor"
              >
                <path
                  d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"
                />
              </svg>
            </a>
            <button
              @click="toggleTheme"
              class="icon-btn"
              aria-label="Toggle Theme"
            >
              <svg
                v-if="isDark"
                viewBox="0 0 24 24"
                width="20"
                height="20"
                stroke="currentColor"
                stroke-width="2"
                fill="none"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <circle cx="12" cy="12" r="5"></circle>
                <line x1="12" y1="1" x2="12" y2="3"></line>
                <line x1="12" y1="21" x2="12" y2="23"></line>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                <line x1="1" y1="12" x2="3" y2="12"></line>
                <line x1="21" y1="12" x2="23" y2="12"></line>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
              </svg>
              <svg
                v-else
                viewBox="0 0 24 24"
                width="20"
                height="20"
                stroke="currentColor"
                stroke-width="2"
                fill="none"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path
                  d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
                ></path>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </nav>

    <router-view v-slot="{ Component }">
      <transition name="fade" mode="out-in">
        <component :is="Component" />
      </transition>
    </router-view>

    <footer class="footer">
      <div class="container">
        <div class="footer-content">
          <p>Built with ❤️ for the streaming community</p>
          <p class="copyright">
            &copy; {{ currentYear }} Zentrio. Open Source Software.
          </p>
        </div>
      </div>
    </footer>
  </div>
</template>

<script>
export default {
  name: "App",
  data() {
    return {
      isDark: true,
      isScrolled: false,
    };
  },
  computed: {
    currentYear() {
      return new Date().getFullYear();
    },
  },
  created() {
    // Check local storage (shared with VitePress docs) or system preference
    const savedTheme = localStorage.getItem("vitepress-theme-appearance");
    if (savedTheme) {
      this.isDark = savedTheme === "dark";
    } else {
      this.isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    this.updateTheme();
  },
  mounted() {
    window.addEventListener("scroll", this.handleScroll);
    this.handleScroll(); // Init

    // Listen for theme changes from docs site or other tabs
    window.addEventListener("storage", this.handleStorageChange);
  },
  beforeUnmount() {
    window.removeEventListener("scroll", this.handleScroll);
    window.removeEventListener("storage", this.handleStorageChange);
  },
  methods: {
    handleScroll() {
      this.isScrolled = window.scrollY > 20;
    },
    toggleTheme() {
      this.isDark = !this.isDark;
      localStorage.setItem(
        "vitepress-theme-appearance",
        this.isDark ? "dark" : "light"
      );
      this.updateTheme();
    },
    handleStorageChange(e) {
      if (e.key === "vitepress-theme-appearance" && e.newValue) {
        this.isDark = e.newValue === "dark";
        this.updateTheme();
      }
    },
    updateTheme() {
      if (this.isDark) {
        document.documentElement.classList.add("dark");
        document.documentElement.classList.remove("light");
      } else {
        document.documentElement.classList.add("light");
        document.documentElement.classList.remove("dark");
      }
    },
  },
};
</script>

<style>
:root {
  /* Brand Colors - Matching docs */
  --vp-c-brand-1: #e50914;
  --vp-c-brand-2: #f40612;
  --vp-c-brand-3: #ff1f2b;
  --vp-c-brand-soft: rgba(229, 9, 20, 0.16);

  /* Light Mode (Default) - via .light class actually */
  --vp-c-bg: #ffffff;
  --vp-c-bg-alt: #f6f6f7;
  --vp-c-bg-soft: rgba(0, 0, 0, 0.05);

  /* Text */
  --vp-c-text-1: #1a1a1a;
  --vp-c-text-2: #666666;
  --vp-c-text-3: #888888;

  /* Borders */
  --vp-c-border: rgba(0, 0, 0, 0.1);
  --vp-c-divider: rgba(0, 0, 0, 0.1);

  /* Glassmorphism */
  --vp-nav-bg-color: rgba(255, 255, 255, 0.8);
  --vp-backdrop-filter: blur(20px);

  /* Legacy/Mapped variables for existing components */
  --accent: var(--vp-c-brand-1);
  --accent-hover: var(--vp-c-brand-2);
  --bg: var(--vp-c-bg);
  --text: var(--vp-c-text-1);
  --text-muted: var(--vp-c-text-2);
  --card-bg: var(--vp-c-bg-soft);
  --card-border: var(--vp-c-border);
  --nav-bg: var(--vp-nav-bg-color);
}

/* Dark Mode Overrides - Applied when .dark class is present */
.landing-page:not(.light) {
  --vp-c-bg: #141414;
  --vp-c-bg-alt: #0a0a0a;
  --vp-c-bg-soft: rgba(255, 255, 255, 0.05);

  --vp-c-text-1: #ffffff;
  --vp-c-text-2: #b3b3b3;
  --vp-c-text-3: #888888;

  --vp-c-border: rgba(255, 255, 255, 0.1);
  --vp-c-divider: rgba(255, 255, 255, 0.1);

  --vp-nav-bg-color: rgba(20, 20, 20, 0.8);

  /* Update mapped vars */
  --bg: var(--vp-c-bg);
  --text: var(--vp-c-text-1);
  --text-muted: var(--vp-c-text-2);
  --card-bg: var(--vp-c-bg-soft);
  --card-border: var(--vp-c-border);
  --nav-bg: var(--vp-nav-bg-color);
}

.light {
  /* Variables are already default in root, but ensure mapping is correct if specific overrides needed */
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: "Inter", "Helvetica Neue", Arial, sans-serif;
  line-height: 1.6;
  color: var(--text);
  background-color: var(--bg);
  overflow-x: hidden;
  /* Smoother theme transition matching VitePress */
  transition: background-color 0.5s ease, color 0.5s ease;
}

.landing-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  position: relative;
}

.background-effect {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: radial-gradient(
      circle at 15% 50%,
      rgba(229, 9, 20, 0.08),
      transparent 25%
    ),
    radial-gradient(circle at 85% 30%, rgba(229, 9, 20, 0.05), transparent 25%);
  z-index: -1;
  pointer-events: none;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px;
}

/* Navbar - Matches VitePress nav styling */
.navbar {
  height: 64px;
  display: flex;
  align-items: center;
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  z-index: 50;
  /* Always show backdrop like VitePress */
  background-color: var(--nav-bg);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--card-border);
  /* Smooth theme transitions */
  transition: background-color 0.5s ease, border-color 0.5s ease;
}

.nav-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.logo-area {
  display: flex;
  align-items: center;
  gap: 12px;
  text-decoration: none;
  color: var(--text);
}

.nav-logo {
  width: 32px;
  height: 32px;
  border-radius: 6px;
}

.nav-title {
  font-weight: 700;
  font-size: 1.2rem;
  letter-spacing: -0.5px;
}

.nav-links {
  display: flex;
  align-items: center;
  gap: 24px;
}

.nav-link {
  color: var(--text-muted);
  text-decoration: none;
  font-size: 0.95rem;
  transition: color 0.3s ease;
}

.nav-link:hover,
.nav-link.router-link-active {
  color: var(--text);
}

.nav-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-left: 12px;
  padding-left: 24px;
  border-left: 1px solid var(--card-border);
}

.icon-btn {
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 8px;
  border-radius: 8px;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.icon-btn:hover {
  color: var(--text);
  background: var(--card-bg);
}

/* Buttons */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  text-decoration: none;
  transition: all 0.3s ease;
  border: 1px solid transparent;
  cursor: pointer;
  font-size: 1rem;
}

.btn-lg {
  padding: 16px 32px;
  font-size: 1.1rem;
}

.btn-icon {
  margin-right: 8px;
  font-size: 0.9em;
}

.btn-primary {
  background: var(--accent);
  color: white;
  box-shadow: 0 4px 15px rgba(229, 9, 20, 0.3);
}

.btn-primary:hover {
  background: var(--accent-hover);
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(229, 9, 20, 0.4);
}

.btn-secondary {
  background: var(--card-bg);
  color: var(--text);
  border-color: var(--card-border);
  backdrop-filter: blur(10px);
}

.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: var(--text-muted);
  transform: translateY(-2px);
}

.light .btn-secondary:hover {
  background: rgba(0, 0, 0, 0.05);
}

/* Footer */
.footer {
  padding: 60px 0;
  text-align: center;
  border-top: 1px solid var(--card-border);
  margin-top: auto;
}

.footer-content p {
  color: var(--text-muted);
  margin-bottom: 8px;
}

.copyright {
  font-size: 0.9rem;
  opacity: 0.6;
}

/* Page Transitions */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Shared Styles for Views */
.hero {
  min-height: 90vh;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 100px 0 60px;
}

.hero-content {
  max-width: 800px;
  margin: 0 auto;
}

.logo-wrapper {
  margin-bottom: 30px;
  animation: float 6s ease-in-out infinite;
}

.hero-logo {
  width: 120px;
  height: 120px;
  border-radius: 24px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
}

.hero-title {
  font-size: 4rem;
  font-weight: 800;
  line-height: 1.1;
  margin-bottom: 24px;
  letter-spacing: -0.02em;
  color: var(--text);
}

.text-gradient {
  background: linear-gradient(135deg, var(--text) 0%, #e50914 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.hero-subtitle {
  font-size: 1.25rem;
  color: var(--text-muted);
  margin-bottom: 40px;
  max-width: 600px;
  margin-left: auto;
  margin-right: auto;
}

.hero-actions {
  display: flex;
  gap: 16px;
  justify-content: center;
  margin-bottom: 40px;
  flex-wrap: wrap;
}

.hero-badges {
  display: flex;
  gap: 12px;
  justify-content: center;
  flex-wrap: wrap;
}

.badge {
  background: var(--card-bg);
  border: 1px solid var(--card-border);
  padding: 6px 12px;
  border-radius: 100px;
  font-size: 0.85rem;
  color: var(--text-muted);
}

.features {
  padding: 80px 0;
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 24px;
}

.feature-card {
  background: var(--card-bg);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid var(--card-border);
  border-radius: 16px;
  padding: 32px;
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.feature-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
  border-color: var(--text-muted);
}

.feature-icon {
  font-size: 2.5rem;
  margin-bottom: 20px;
}

.feature-card h3 {
  font-size: 1.25rem;
  margin-bottom: 12px;
  color: var(--text);
}

.feature-card p {
  color: var(--text-muted);
  font-size: 0.95rem;
  line-height: 1.6;
}

@keyframes float {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
}

@media (max-width: 768px) {
  .hero-title {
    font-size: 2.5rem;
  }

  .hero-subtitle {
    font-size: 1.1rem;
  }

  .hero-actions {
    flex-direction: column;
    align-items: stretch;
    max-width: 300px;
    margin-left: auto;
    margin-right: auto;
  }

  .btn {
    width: 100%;
  }

  .nav-links {
    gap: 16px;
  }

  .nav-link {
    display: none; /* Hide text links on mobile, keep icons */
  }

  .nav-actions {
    margin-left: 0;
    padding-left: 0;
    border-left: none;
  }
}
</style>
