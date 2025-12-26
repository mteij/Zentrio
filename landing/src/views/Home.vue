<template>
  <div class="home-view">
    <ParticleBackground :color="[229, 9, 20]" />

    <header class="hero">
      <div class="container hero-container">
        <div class="hero-content">
          <div class="logo-wrapper-animated">
            <AnimatedLogo />
          </div>

          <h1 class="hero-title fade-in-up delay-1">
            Stream <span class="text-gradient">Your Way</span>
          </h1>

          <p class="hero-subtitle fade-in-up delay-2">
            A precise, self-hosted streaming platform. Profile management,
            cross-device sync, and additive power.
          </p>

          <div class="hero-actions fade-in-up delay-3">
            <a
              href="https://app.zentrio.eu"
              class="btn btn-primary btn-lg shine-effect"
            >
              <span class="btn-icon">▶</span> Launch Zentrio
            </a>
            <a
              href="https://docs.zentrio.eu/self-hosting"
              class="btn btn-secondary btn-lg"
            >
              Self Host
            </a>
          </div>

          <div class="hero-badges fade-in-up delay-4">
            <span v-for="badge in badges" :key="badge" class="badge">
              {{ badge }}
            </span>
          </div>
        </div>
      </div>
    </header>

    <main class="features-section">
      <div class="section-header">
        <h2 class="section-title fade-in-up">Engineered for Performance</h2>
        <p class="section-subtitle fade-in-up" style="animation-delay: 0.1s">
          Everything you need for a premium streaming experience.
        </p>
      </div>

      <BentoGrid />
    </main>
  </div>
</template>

<script setup>
import ParticleBackground from "../components/ParticleBackground.vue";
import AnimatedLogo from "../components/AnimatedLogo.vue";
import BentoGrid from "../components/BentoGrid.vue";

const badges = ["v1.0.0", "Open Source", "Privacy Focused"];
</script>

<style scoped>
.home-view {
  position: relative;
  overflow: hidden;
}

.hero {
  position: relative;
  z-index: 1;
}

.logo-wrapper-animated {
  margin-bottom: 40px;
  display: flex;
  justify-content: center;
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
    rgba(255, 255, 255, 0.3) 50%,
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

/* CSS Entry Animations */
.fade-in-up {
  opacity: 0;
  animation: fadeInUp 0.8s ease-out forwards;
}

.delay-1 {
  animation-delay: 0.2s;
}
.delay-2 {
  animation-delay: 0.4s;
}
.delay-3 {
  animation-delay: 0.6s;
}
.delay-4 {
  animation-delay: 0.8s;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Features Section */
.features-section {
  padding: 80px 0 120px;
  position: relative;
  z-index: 1;
}

.section-header {
  margin-bottom: 60px;
  text-align: center;
  padding: 0 20px;
}

.section-title {
  font-size: 2.5rem;
  font-weight: 700;
  color: var(--text);
  margin-bottom: 16px;
  letter-spacing: -0.02em;
}

.section-subtitle {
  color: var(--text-muted);
  font-size: 1.1rem;
  max-width: 600px;
  margin: 0 auto;
}

@media (max-width: 768px) {
  .section-title {
    font-size: 2rem;
  }

  .features-section {
    padding: 60px 0 80px;
  }
}
</style>
