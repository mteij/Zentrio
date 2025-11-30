<template>
  <div class="home-view">
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
  </div>
</template>

<script>
export default {
  name: 'Home'
}
</script>