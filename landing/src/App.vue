<template>
  <div class="landing-page">
    <header class="hero">
      <div class="hero-content">
        <img src="/icon-512.png" alt="Zentrio" class="hero-logo" />
        <h1 class="hero-title">Zentrio</h1>
        <p class="hero-subtitle">Your Personal Streaming Hub</p>
        <p class="hero-description">A modern, self-hosted streaming platform for all your content.</p>
        <div class="hero-actions">
          <a href="https://app.zentrio.eu" class="btn btn-primary">Try Zentrio</a>
          <a href="https://docs.zentrio.eu/getting-started" class="btn btn-secondary">Get started</a>
          <a href="https://docs.zentrio.eu/self-hosting-docker" class="btn btn-secondary">Self host with Docker</a>
        </div>
      </div>
    </header>

    <main class="features">
      <div class="container">
        <div class="features-grid">
          <div class="feature-card">
            <div class="feature-icon">👥</div>
            <h3>Profile Management</h3>
            <p>Create separate profiles with unique preferences, watch history, and addon configurations.</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon">🎨</div>
            <h3>Modern Experience</h3>
            <p>A clean, glassmorphic interface designed for immersion and ease of use on any device.</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon">🧩</div>
            <h3>Addon System</h3>
            <p>Extend functionality with Stremio-compatible addons to access a wide range of content.</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon">🔒</div>
            <h3>Privacy & Control</h3>
            <p>Run Zentrio yourself with Docker and keep all your data on your own infrastructure.</p>
          </div>
          <div class="feature-card">
            <div class="feature-icon">📱</div>
            <h3>Cross-Platform</h3>
            <p>Seamless experience across web, iOS, Android, and PWA.</p>
          </div>
        </div>
      </div>
    </main>

    <footer class="footer">
      <div class="container">
        <p>Built for the Stremio community</p>
        <p>&copy; {{ currentYear }} Zentrio</p>
        <div class="footer-links">
          <a href="https://docs.zentrio.eu">Documentation</a>
          <a href="https://github.com/MichielEijpe/Zentrio">GitHub</a>
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
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  line-height: 1.6;
  color: #333;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  min-height: 100vh;
}

.landing-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.hero {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 2rem;
  color: white;
}

.hero-content {
  max-width: 600px;
}

.hero-logo {
  width: 120px;
  height: 120px;
  margin-bottom: 1rem;
  border-radius: 20px;
}

.hero-title {
  font-size: 3.5rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
  text-shadow: 0 2px 4px rgba(0,0,0,0.3);
}

.hero-subtitle {
  font-size: 1.5rem;
  margin-bottom: 1rem;
  opacity: 0.9;
}

.hero-description {
  font-size: 1.1rem;
  margin-bottom: 2rem;
  opacity: 0.8;
}

.hero-actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
  flex-wrap: wrap;
}

.btn {
  display: inline-block;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  text-decoration: none;
  font-weight: 600;
  transition: all 0.3s ease;
  border: none;
  cursor: pointer;
}

.btn-primary {
  background: #0366d6;
  color: white;
}

.btn-primary:hover {
  background: #0256cc;
  transform: translateY(-2px);
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.2);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.3);
}

.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: translateY(-2px);
}

.features {
  background: rgba(255, 255, 255, 0.95);
  padding: 4rem 2rem;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 2rem;
}

.feature-card {
  text-align: center;
  padding: 2rem;
  border-radius: 12px;
  background: white;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  transition: transform 0.3s ease;
}

.feature-card:hover {
  transform: translateY(-5px);
}

.feature-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.feature-card h3 {
  font-size: 1.5rem;
  margin-bottom: 1rem;
  color: #333;
}

.feature-card p {
  color: #666;
  line-height: 1.6;
}

.footer {
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 2rem;
  text-align: center;
}

.footer-links {
  margin-top: 1rem;
}

.footer-links a {
  color: white;
  text-decoration: none;
  margin: 0 1rem;
  opacity: 0.8;
}

.footer-links a:hover {
  opacity: 1;
}

@media (max-width: 768px) {
  .hero-title {
    font-size: 2.5rem;
  }
  
  .hero-subtitle {
    font-size: 1.2rem;
  }
  
  .hero-actions {
    flex-direction: column;
    align-items: center;
  }
  
  .btn {
    width: 200px;
  }
}
</style>