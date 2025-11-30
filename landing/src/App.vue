<template>
  <div class="landing-page">
    <div class="background-effect"></div>
    
    <nav class="navbar">
      <div class="container nav-content">
        <div class="logo-area">
          <img src="/icon-512.png" alt="Zentrio" class="nav-logo" />
          <span class="nav-title">Zentrio</span>
        </div>
        <div class="nav-links">
          <a href="https://docs.zentrio.eu" class="nav-link">Documentation</a>
          <a href="https://github.com/MichielEijpe/Zentrio" class="nav-link">GitHub</a>
        </div>
      </div>
    </nav>

    <header class="hero">
      <div class="container hero-container">
        <div class="hero-content">
          <div class="logo-wrapper">
            <img src="/icon-512.png" alt="Zentrio" class="hero-logo" />
          </div>
          <h1 class="hero-title">Your Personal<br/><span class="text-gradient">Streaming Hub</span></h1>
          <p class="hero-subtitle">
            A modern, self-hosted streaming platform designed for immersion. 
            Manage profiles, sync across devices, and extend with addons.
          </p>
          
          <div class="hero-actions">
            <a href="https://app.zentrio.eu" class="btn btn-primary btn-lg">
              <span class="btn-icon">▶</span> Launch Zentrio
            </a>
            <a href="https://docs.zentrio.eu/getting-started" class="btn btn-secondary btn-lg">
              Self Host
            </a>
          </div>
          
          <div class="hero-badges">
            <span class="badge">v1.0.0</span>
            <span class="badge">Open Source</span>
            <span class="badge">Privacy Focused</span>
          </div>
        </div>
      </div>
    </header>

    <main class="features">
      <div class="container">
        <div class="features-grid">
          <div class="feature-card">
            <div class="feature-icon">👥</div>
            <h3>Profile Management</h3>
            <p>Create separate profiles for everyone in your household with unique preferences and watch history.</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon">🎨</div>
            <h3>Modern Interface</h3>
            <p>A clean, glassmorphic design that focuses on your content, providing a cinematic experience.</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon">🧩</div>
            <h3>Addon System</h3>
            <p>Compatible with Stremio addons. Extend functionality to access a wide range of content sources.</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon">🔄</div>
            <h3>Cross-Platform Sync</h3>
            <p>Seamlessly sync your progress and settings across all your devices, from desktop to mobile.</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon">🔒</div>
            <h3>Privacy First</h3>
            <p>Your data stays with you. Self-host with Docker and keep full control over your viewing habits.</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon">📱</div>
            <h3>PWA Support</h3>
            <p>Install as a Progressive Web App on iOS and Android for a native-like app experience.</p>
          </div>
        </div>
      </div>
    </main>

    <footer class="footer">
      <div class="container">
        <div class="footer-content">
          <p>Built with ❤️ for the streaming community</p>
          <p class="copyright">&copy; {{ currentYear }} Zentrio. Open Source Software.</p>
        </div>
      </div>
    </footer>
  </div>
</template>

<script>
export default {
  name: 'App',
  computed: {
    currentYear() {
      return new Date().getFullYear()
    }
  }
}
</script>

<style>
:root {
  --accent: #e50914;
  --accent-hover: #f40612;
  --bg: #141414;
  --text: #ffffff;
  --text-muted: #b3b3b3;
  --card-bg: rgba(255, 255, 255, 0.05);
  --card-border: rgba(255, 255, 255, 0.1);
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Helvetica Neue', Arial, sans-serif;
  line-height: 1.6;
  color: var(--text);
  background-color: var(--bg);
  overflow-x: hidden;
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
  background: 
    radial-gradient(circle at 15% 50%, rgba(229, 9, 20, 0.08), transparent 25%),
    radial-gradient(circle at 85% 30%, rgba(229, 9, 20, 0.05), transparent 25%);
  z-index: -1;
  pointer-events: none;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px;
}

/* Navbar */
.navbar {
  padding: 20px 0;
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  z-index: 10;
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
  gap: 24px;
}

.nav-link {
  color: var(--text-muted);
  text-decoration: none;
  font-size: 0.95rem;
  transition: color 0.3s ease;
}

.nav-link:hover {
  color: var(--text);
}

/* Hero Section */
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
  box-shadow: 0 20px 40px rgba(0,0,0,0.3);
}

.hero-title {
  font-size: 4rem;
  font-weight: 800;
  line-height: 1.1;
  margin-bottom: 24px;
  letter-spacing: -0.02em;
}

.text-gradient {
  background: linear-gradient(135deg, #ffffff 0%, #e50914 100%);
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
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 6px 12px;
  border-radius: 100px;
  font-size: 0.85rem;
  color: var(--text-muted);
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
  background: rgba(255, 255, 255, 0.05);
  color: white;
  border-color: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
}

.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
  transform: translateY(-2px);
}

/* Features Section */
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
  border-color: rgba(255, 255, 255, 0.2);
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

/* Footer */
.footer {
  padding: 60px 0;
  text-align: center;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
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

/* Animations */
@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}

/* Responsive */
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
}
</style>