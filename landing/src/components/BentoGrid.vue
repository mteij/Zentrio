<template>
  <div
    ref="gridRef"
    class="bento-grid"
    @mousemove="handleMouseMove"
    @mouseleave="handleMouseLeave"
  >
    <!-- Hero Card - Large left -->
    <div
      class="bento-card hero-card"
      :style="getCardStyle(0)"
      @mouseenter="activeCard = 0"
      @mouseleave="activeCard = -1"
    >
      <div class="card-glow" :style="getGlowStyle(0)"></div>
      <div class="card-content">
        <div class="app-preview">
          <div class="device-frame">
            <div class="device-screen">
              <div class="mock-ui">
                <div class="mock-header">
                  <div class="mock-logo"></div>
                  <div class="mock-nav">
                    <div class="mock-nav-item"></div>
                    <div class="mock-nav-item"></div>
                    <div class="mock-nav-item"></div>
                  </div>
                </div>
                <div class="mock-content">
                  <div class="mock-card"></div>
                  <div class="mock-card"></div>
                  <div class="mock-card small"></div>
                  <div class="mock-card small"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="hero-text">
          <h3>Modern Streaming Experience</h3>
          <p>
            A beautiful, performant interface designed for the way you watch.
          </p>
        </div>
      </div>
    </div>

    <!-- Feature Cards -->
    <div
      v-for="(feature, index) in features"
      :key="feature.title"
      class="bento-card"
      :class="[feature.size || 'normal']"
      :style="getCardStyle(index + 1)"
      @mouseenter="activeCard = index + 1"
      @mouseleave="activeCard = -1"
    >
      <div class="card-glow" :style="getGlowStyle(index + 1)"></div>
      <div class="card-content">
        <div class="icon-wrapper" :style="{ background: feature.gradient }">
          <component :is="feature.icon" class="feature-icon" />
        </div>
        <h3>{{ feature.title }}</h3>
        <p>{{ feature.description }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from "vue";
import {
  Users,
  Shield,
  Puzzle,
  RefreshCw,
  Smartphone,
  Layers,
} from "lucide-vue-next";

const features = [
  {
    icon: Users,
    title: "Family Profiles",
    description: "Separate watch history and preferences for everyone.",
    gradient: "linear-gradient(135deg, #a855f7, #6366f1)",
    size: "normal",
  },
  {
    icon: Shield,
    title: "Privacy First",
    description: "Self-host your data. No tracking, ever.",
    gradient: "linear-gradient(135deg, #10b981, #059669)",
    size: "normal",
  },
  {
    icon: Puzzle,
    title: "Addon System",
    description: "Extend with community addons and custom sources.",
    gradient: "linear-gradient(135deg, #f97316, #dc2626)",
    size: "wide",
  },
  {
    icon: RefreshCw,
    title: "Instant Sync",
    description: "Continue watching across all your devices.",
    gradient: "linear-gradient(135deg, #3b82f6, #0ea5e9)",
    size: "normal",
  },
  {
    icon: Smartphone,
    title: "Native Apps",
    description: "Desktop, mobile, and web. One experience.",
    gradient: "linear-gradient(135deg, #e50914, #dc2626)",
    size: "normal",
  },
];

const gridRef = ref(null);
const mouseX = ref(0);
const mouseY = ref(0);
const activeCard = ref(-1);
const cardPositions = ref([]);

const handleMouseMove = (e) => {
  if (!gridRef.value) return;
  const rect = gridRef.value.getBoundingClientRect();
  mouseX.value = e.clientX - rect.left;
  mouseY.value = e.clientY - rect.top;
};

const handleMouseLeave = () => {
  activeCard.value = -1;
};

const getCardStyle = (index) => {
  const delay = index * 0.08;
  return {
    animationDelay: `${delay}s`,
  };
};

const getGlowStyle = (index) => {
  if (activeCard.value !== index) {
    return { opacity: 0 };
  }
  return {
    opacity: 1,
    background: `radial-gradient(600px circle at ${mouseX.value}px ${mouseY.value}px, rgba(229, 9, 20, 0.15), transparent 40%)`,
  };
};
</script>

<style scoped>
.bento-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  grid-template-rows: auto auto auto;
  gap: 20px;
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px;
}

.bento-card {
  position: relative;
  background: rgba(20, 20, 20, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 20px;
  overflow: hidden;
  cursor: pointer;
  animation: cardEnter 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  opacity: 0;
  transform: translateY(30px);
  transition: transform 0.3s ease, border-color 0.3s ease;
}

.bento-card:hover {
  border-color: rgba(255, 255, 255, 0.15);
  transform: translateY(-4px);
}

@keyframes cardEnter {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Hero card spans 2 columns and 2 rows */
.hero-card {
  grid-column: span 2;
  grid-row: span 2;
  min-height: 400px;
}

/* Wide card spans 2 columns */
.wide {
  grid-column: span 2;
}

.card-glow {
  position: absolute;
  inset: 0;
  pointer-events: none;
  transition: opacity 0.4s ease;
  z-index: 1;
}

.card-content {
  position: relative;
  z-index: 2;
  padding: 32px;
  height: 100%;
  display: flex;
  flex-direction: column;
}

/* Hero card specific styles */
.hero-card .card-content {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.app-preview {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 24px;
}

.device-frame {
  width: 100%;
  max-width: 320px;
  aspect-ratio: 16/10;
  background: linear-gradient(135deg, #2a2a2a, #1a1a1a);
  border-radius: 12px;
  padding: 8px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
  transform: perspective(1000px) rotateX(5deg) rotateY(-5deg);
  transition: transform 0.5s ease;
}

.hero-card:hover .device-frame {
  transform: perspective(1000px) rotateX(0) rotateY(0);
}

.device-screen {
  width: 100%;
  height: 100%;
  background: #0a0a0a;
  border-radius: 8px;
  overflow: hidden;
}

.mock-ui {
  width: 100%;
  height: 100%;
  padding: 12px;
}

.mock-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.mock-logo {
  width: 24px;
  height: 24px;
  background: #e50914;
  border-radius: 4px;
}

.mock-nav {
  display: flex;
  gap: 8px;
}

.mock-nav-item {
  width: 32px;
  height: 8px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
}

.mock-content {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.mock-card {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  aspect-ratio: 16/9;
}

.mock-card.small {
  aspect-ratio: 16/12;
}

.hero-text {
  text-align: center;
}

.hero-text h3 {
  font-size: 1.5rem;
  font-weight: 700;
  color: #fff;
  margin-bottom: 8px;
}

.hero-text p {
  color: #a1a1aa;
  font-size: 1rem;
  line-height: 1.5;
}

/* Feature card styles */
.icon-wrapper {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
  transition: transform 0.3s ease;
}

.bento-card:hover .icon-wrapper {
  transform: scale(1.1);
}

.feature-icon {
  width: 24px;
  height: 24px;
  color: white;
}

.bento-card h3 {
  color: #fff;
  font-size: 1.15rem;
  font-weight: 600;
  margin-bottom: 8px;
}

.bento-card p {
  color: #a1a1aa;
  font-size: 0.95rem;
  line-height: 1.5;
  margin: 0;
}

/* Light mode adjustments */
:global(.light) .bento-card {
  background: rgba(255, 255, 255, 0.8);
  border-color: rgba(0, 0, 0, 0.08);
}

:global(.light) .bento-card:hover {
  border-color: rgba(0, 0, 0, 0.15);
}

:global(.light) .bento-card h3 {
  color: #1a1a1a;
}

:global(.light) .bento-card p {
  color: #666;
}

:global(.light) .device-frame {
  background: linear-gradient(135deg, #f0f0f0, #e0e0e0);
}

:global(.light) .device-screen {
  background: #fff;
}

:global(.light) .mock-logo {
  background: #e50914;
}

:global(.light) .mock-nav-item {
  background: rgba(0, 0, 0, 0.1);
}

:global(.light) .mock-card {
  background: rgba(0, 0, 0, 0.05);
}

:global(.light) .card-glow {
  background: radial-gradient(
    600px circle at var(--mouse-x) var(--mouse-y),
    rgba(229, 9, 20, 0.08),
    transparent 40%
  );
}

/* Responsive */
@media (max-width: 1024px) {
  .bento-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .hero-card {
    grid-column: span 2;
    grid-row: span 1;
    min-height: 300px;
  }

  .wide {
    grid-column: span 2;
  }
}

@media (max-width: 640px) {
  .bento-grid {
    grid-template-columns: 1fr;
    gap: 16px;
  }

  .hero-card,
  .wide {
    grid-column: span 1;
  }

  .hero-card {
    min-height: 350px;
  }

  .card-content {
    padding: 24px;
  }
}
</style>
