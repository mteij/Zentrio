<template>
  <div class="landing-page dark">
    <div class="background-effect"></div>

    <nav class="navbar" :class="{ scrolled: isScrolled }">
      <div class="container nav-content">
        <router-link to="/" class="logo-area">
          <img src="/icon-512.png" alt="Zentrio" class="nav-logo" />
          <span class="nav-title">Zentrio</span>
        </router-link>

        <div class="nav-right">
          <div class="nav-links">
            <a href="https://app.zentrio.eu" class="nav-link highlight"
              >Zentrio Web</a
            >
            <router-link to="/releases" class="nav-link">Releases</router-link>
            <a href="https://docs.zentrio.eu" class="nav-link">Documentation</a>
          </div>

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
          </div>
        </div>
      </div>
    </nav>

    <main class="main-content">
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </main>

    <footer class="footer">
      <div class="container footer-container">
        <div class="footer-left">
          <div class="footer-brand">
            <img src="/icon-512.png" alt="Zentrio Logo" class="footer-logo" />
            <span>Zentrio</span>
          </div>
          <p class="footer-description">
            Built with ❤️ for the streaming community
          </p>
        </div>
        <div class="footer-right">
          <div class="footer-links">
            <a href="https://app.zentrio.eu" class="footer-link">Zentrio Web</a>
            <router-link to="/releases" class="footer-link"
              >Releases</router-link
            >
            <a href="https://docs.zentrio.eu" class="footer-link"
              >Documentation</a
            >
            <a href="https://github.com/mteij/Zentrio" class="footer-link"
              >GitHub</a
            >
            <router-link to="/tos" class="footer-link"
              >Terms of Service</router-link
            >
          </div>
          <p class="copyright">
            &copy; {{ currentYear }} Zentrio. Open Source Software.
          </p>
        </div>
      </div>
    </footer>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from "vue";

const isScrolled = ref(false);
const currentYear = computed(() => new Date().getFullYear());

const handleScroll = () => {
  isScrolled.value = window.scrollY > 20;
};

onMounted(() => {
  window.addEventListener("scroll", handleScroll);
  handleScroll();
});

onUnmounted(() => {
  window.removeEventListener("scroll", handleScroll);
});
</script>

<style>
/* Modern Dark Variables */
:root {
  --accent: #e50914;
  --accent-hover: #ff1f2b;
  --bg: #0d0d0f; /* Deep dark background */
  --bg-alt: #141417; /* Slightly lighter card background */
  --bg-soft: rgba(255, 255, 255, 0.03);

  --text: #ffffff;
  --text-muted: #a0a0a5;
  --text-dim: #66666e;

  --border: rgba(255, 255, 255, 0.08);
  --border-hover: rgba(255, 255, 255, 0.15);

  --nav-bg: rgba(13, 13, 15, 0.75);
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family:
    "Inter",
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    Roboto,
    Helvetica,
    Arial,
    sans-serif;
  line-height: 1.6;
  color: var(--text);
  background-color: var(--bg);
  overflow-x: hidden;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* Global Typography Elements */
h1,
h2,
h3,
h4,
h5,
h6 {
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: -0.02em;
}

.landing-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  position: relative;
}

.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
}

/* Base Abstract Background Effect */
.background-effect {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background:
    radial-gradient(
      circle at 15% 0%,
      rgba(229, 9, 20, 0.08) 0%,
      transparent 40%
    ),
    radial-gradient(
      circle at 85% 100%,
      rgba(120, 0, 255, 0.05) 0%,
      transparent 40%
    );
  z-index: -1;
  pointer-events: none;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 24px;
}

/* Navbar */
.navbar {
  height: 72px;
  display: flex;
  align-items: center;
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  z-index: 100;
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  background-color: transparent;
}

.navbar.scrolled {
  background-color: var(--nav-bg);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-bottom: 1px solid var(--border);
}

.nav-content {
  width: 100%;
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
  width: 36px;
  height: 36px;
  border-radius: 8px;
}

.nav-title {
  font-weight: 800;
  font-size: 1.25rem;
  letter-spacing: -0.5px;
}

.nav-right {
  display: flex;
  align-items: center;
  gap: 32px;
}

.nav-links {
  display: flex;
  align-items: center;
  gap: 28px;
}

.nav-link {
  color: var(--text-muted);
  text-decoration: none;
  font-size: 0.95rem;
  font-weight: 500;
  transition: color 0.2s ease;
}

.nav-link:hover,
.nav-link.router-link-active {
  color: var(--text);
}

.nav-link.highlight {
  color: var(--text);
  position: relative;
}

.nav-link.highlight::after {
  content: "";
  position: absolute;
  bottom: -4px;
  left: 0;
  width: 100%;
  height: 2px;
  background-color: var(--accent);
  transform: scaleX(0);
  transform-origin: right;
  transition: transform 0.3s ease;
}

.nav-link.highlight:hover::after {
  transform: scaleX(1);
  transform-origin: left;
}

.nav-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-left: 32px;
  border-left: 1px solid var(--border);
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
  background: rgba(255, 255, 255, 0.05);
}

/* Global Buttons */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 14px 28px;
  border-radius: 12px;
  font-weight: 600;
  text-decoration: none;
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  border: 1px solid transparent;
  cursor: pointer;
  font-size: 1rem;
  gap: 8px;
}

.btn-lg {
  padding: 16px 36px;
  font-size: 1.1rem;
}

.btn-primary {
  background: var(--accent);
  color: white;
}

.btn-primary:hover {
  background: var(--accent-hover);
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(229, 9, 20, 0.4);
}

.btn-secondary {
  background: var(--bg-soft);
  color: var(--text);
  border-color: var(--border);
  backdrop-filter: blur(10px);
}

.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: var(--border-hover);
  transform: translateY(-2px);
}

/* Footer */
.footer {
  padding: 80px 0 40px;
  margin-top: auto;
  position: relative;
  z-index: 10;
  border-top: 1px solid var(--border);
  background-color: rgba(13, 13, 15, 0.8);
}

.footer-container {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 40px;
}

.footer-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 1.5rem;
  font-weight: 800;
  color: var(--text);
  margin-bottom: 16px;
}

.footer-logo {
  width: 32px;
  height: 32px;
  border-radius: 8px;
}

.footer-description {
  color: var(--text-muted);
  font-size: 1rem;
  max-width: 300px;
}

.footer-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.footer-links {
  display: flex;
  gap: 24px;
  margin-bottom: 24px;
}

.footer-link {
  color: var(--text-muted);
  text-decoration: none;
  font-size: 0.95rem;
  transition: color 0.2s;
}

.footer-link:hover {
  color: var(--text);
}

.copyright {
  font-size: 0.9rem;
  color: var(--text-dim);
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

/* Responsive */
@media (max-width: 768px) {
  .nav-right {
    gap: 16px;
  }

  .nav-links {
    display: none; /* Can add hamburger menu later if needed, simple for now */
  }

  .nav-actions {
    padding-left: 0;
    border-left: none;
  }

  .footer-container {
    flex-direction: column;
    align-items: flex-start;
  }

  .footer-right {
    align-items: flex-start;
  }

  .footer-links {
    flex-wrap: wrap;
  }
}
</style>
