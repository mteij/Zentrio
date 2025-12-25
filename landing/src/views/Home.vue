<template>
  <div class="home-view">
    <ParticleBackground :color="isDark ? [229, 9, 20] : [229, 9, 20]" />

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
              href="https://docs.zentrio.eu/getting-started"
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
      <div class="container">
        <div class="section-header text-center mb-16">
          <h2 class="section-title">Engineered for Performance</h2>
          <p class="section-subtitle">
            Everything you need for a premium streaming experience.
          </p>
        </div>

        <div class="glow-grid">
          <GlowCard
            v-for="(feature, index) in features"
            :key="index"
            v-bind="feature"
            class="fade-in-up"
            :style="{ 'animation-delay': index * 0.1 + 's' }"
          />
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref } from "vue";
import ParticleBackground from "../components/ParticleBackground.vue";
import AnimatedLogo from "../components/AnimatedLogo.vue";
import GlowCard from "../components/GlowCard.vue";
import {
  Users,
  MonitorPlay,
  Puzzle,
  RefreshCw,
  Shield,
  Smartphone,
  Layers,
} from "lucide-vue-next";

const isDark = ref(true);
const badges = ["v1.0.0", "Open Source", "Privacy Focused"];

const features = [
  {
    icon: Layers,
    title: "Modern Interface",
    description:
      "A clean, distraction-free design that puts your content first. Glassmorphic aesthetics meet functional precision.",
    gradient:
      "linear-gradient(135deg, rgba(236, 72, 153, 0.5), rgba(219, 39, 119, 0.5))",
  },
  {
    icon: Users,
    title: "Family Profiles",
    description:
      "Granular profile management. Keep watch history and recommendations separate for every household member.",
    gradient:
      "linear-gradient(135deg, rgba(168, 85, 247, 0.5), rgba(79, 70, 229, 0.5))",
  },
  {
    icon: Shield,
    title: "Privacy First",
    description:
      "Self-host with Docker. Your data never leaves your infrastructure unless you want it to.",
    gradient:
      "linear-gradient(135deg, rgba(16, 185, 129, 0.5), rgba(5, 150, 105, 0.5))",
  },
  {
    icon: Puzzle,
    title: "Addon Architecture",
    description:
      "Extend core functionality with community addons. Compatible with popular metadata and source providers.",
    gradient:
      "linear-gradient(135deg, rgba(249, 115, 22, 0.5), rgba(220, 38, 38, 0.5))",
  },
  {
    icon: RefreshCw,
    title: "Instant Sync",
    description:
      "Pick up exactly where you left off. State is synchronized in real-time across all connected clients.",
    gradient:
      "linear-gradient(135deg, rgba(59, 130, 246, 0.5), rgba(14, 165, 233, 0.5))",
  },
  {
    icon: Smartphone,
    title: "Native PWA",
    description:
      "Install directly on your device. Responsive, touch-optimized, and feels like a native application.",
    gradient:
      "linear-gradient(135deg, rgba(229, 9, 20, 0.5), rgba(220, 38, 38, 0.5))",
  },
];
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
  padding: 100px 0;
}

.section-header {
  margin-bottom: 60px;
  text-align: center;
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

/* Glow Grid Layout */
.glow-grid {
  display: grid;
  grid-template-columns: repeat(1, 1fr);
  gap: 24px;
}

@media (min-width: 768px) {
  .glow-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (min-width: 1024px) {
  .glow-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}
</style>
