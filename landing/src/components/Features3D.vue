<template>
  <div
    class="carousel-container"
    ref="container"
    @mousemove="onMouseMove"
    @mouseleave="onMouseLeave"
  >
    <div class="world">
      <div class="carousel" :style="carouselStyle">
        <div
          v-for="(feature, index) in features"
          :key="index"
          class="carousel-item"
          :style="getItemStyle(index)"
          @click="activeIndex = index"
        >
          <div class="card-content" :class="{ active: activeIndex === index }">
            <component :is="feature.icon" class="feature-icon" />
            <h3>{{ feature.title }}</h3>
            <p>{{ feature.description }}</p>
          </div>
        </div>
      </div>
    </div>

    <div class="instruction">
      <p>Drag / Hover to Rotate • Click to Focus</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from "vue";
import {
  Users,
  MonitorPlay,
  Puzzle,
  RefreshCw,
  Shield,
  Smartphone,
  Play,
} from "lucide-vue-next";

const features = [
  {
    icon: MonitorPlay || Play,
    title: "Modern Interface",
    description: "Cinematic, glassmorphic design.",
  },
  {
    icon: Users,
    title: "Family Profiles",
    description: "Personalized history for everyone.",
  },
  {
    icon: Puzzle,
    title: "Addon System",
    description: "Extend with unlimited sources.",
  },
  {
    icon: RefreshCw,
    title: "Cross-Platform",
    description: "Sync across all devices.",
  },
  {
    icon: Shield,
    title: "Privacy First",
    description: "Your data, your control.",
  },
  {
    icon: Smartphone,
    title: "PWA Support",
    description: "Native-like mobile experience.",
  },
];

const container = ref(null);
const rotationY = ref(0);
const targetRotationY = ref(0);
const activeIndex = ref(-1);
let animationFrame;

// Config
const radius = 400; // Distance from center
const total = features.length;
const anglePerItem = 360 / total;

const carouselStyle = computed(() => {
  return {
    transform: `translateZ(-${radius}px) rotateY(${rotationY.value}deg)`,
  };
});

const getItemStyle = (index) => {
  const angle = index * anglePerItem;
  return {
    transform: `rotateY(${angle}deg) translateZ(${radius}px)`,
  };
};

const onMouseMove = (e) => {
  if (!container.value) return;
  const width = container.value.clientWidth;
  const x = e.clientX - container.value.getBoundingClientRect().left;
  const normalizedX = x / width - 0.5; // -0.5 to 0.5

  targetRotationY.value = normalizedX * -180; // Rotate +/- 90 degrees based on mouse
};

const onMouseLeave = () => {
  targetRotationY.value = rotationY.value; // Stop spinning or auto spin?
  // Let's create a slow drift
  // targetRotationY.value += 360
};

// Smooth loop
const loop = () => {
  // Lerp
  rotationY.value += (targetRotationY.value - rotationY.value) * 0.05;
  animationFrame = requestAnimationFrame(loop);
};

onMounted(() => {
  loop();
});

onUnmounted(() => {
  cancelAnimationFrame(animationFrame);
});
</script>

<style scoped>
.carousel-container {
  width: 100%;
  height: 500px;
  perspective: 1000px;
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: grab;
}

.world {
  position: relative;
  width: 300px; /* Card Width */
  height: 400px; /* Card Height */
  transform-style: preserve-3d;
}

.carousel {
  width: 100%;
  height: 100%;
  position: absolute;
  transform-style: preserve-3d;
  transition: transform 0.1s cubic-bezier(0, 0, 0.2, 1); /* Smooth updates via JS, but fail-safe CSS */
}

.carousel-item {
  position: absolute;
  width: 280px;
  height: 360px;
  left: 10px;
  top: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  backface-visibility: hidden; /* Or visible for transparency? Visible looks cooler with glass */
  backface-visibility: visible;
}

.card-content {
  width: 100%;
  height: 100%;
  background: rgba(20, 20, 20, 0.6);
  backdrop-filter: blur(15px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 20px;
  padding: 30px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  transition: all 0.3s ease;
  user-select: none;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
}

.card-content:hover,
.card-content.active {
  background: rgba(229, 9, 20, 0.15);
  border-color: #e50914;
  box-shadow: 0 0 30px rgba(229, 9, 20, 0.4);
  transform: scale(1.05);
}

.feature-icon {
  width: 48px;
  height: 48px;
  color: #e50914;
  margin-bottom: 20px;
}

h3 {
  color: white;
  margin: 10px 0;
  font-size: 1.5rem;
}

p {
  color: #aaa;
  font-size: 1rem;
}

.instruction {
  position: absolute;
  bottom: 20px;
  width: 100%;
  text-align: center;
  color: rgba(255, 255, 255, 0.3);
  pointer-events: none;
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 2px;
}
</style>
