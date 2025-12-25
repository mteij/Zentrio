<template>
  <div ref="cardTarget" class="tilt-card-wrapper" :style="cardStyle">
    <div class="tilt-card-content">
      <div class="spotlight-overlay" :style="spotlightStyle" />

      <div class="icon-wrapper" :style="{ background: iconGradient }">
        <component
          :is="iconComponent"
          class="feature-icon"
          :stroke-width="1.5"
        />
      </div>

      <h3>{{ title }}</h3>
      <p>{{ description }}</p>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from "vue";
import { useMouseInElement } from "@vueuse/core";
import { Sparkles } from "lucide-vue-next";

const props = defineProps({
  icon: { type: Object, required: false },
  title: { type: String, required: true },
  description: { type: String, required: true },
  gradient: {
    type: String,
    default:
      "linear-gradient(135deg, rgba(229, 9, 20, 0.1), rgba(229, 9, 20, 0.05))",
  },
});

const cardTarget = ref(null);

const { elementX, elementY, isOutside, elementHeight, elementWidth } =
  useMouseInElement(cardTarget);

// config
const maxRotation = 10; // degrees

const cardStyle = computed(() => {
  if (isOutside.value) {
    return {
      transform: "perspective(1000px) rotateX(0deg) rotateY(0deg) scale(1)",
      transition: "transform 0.5s ease-out",
    };
  }

  const x = elementX.value;
  const y = elementY.value;
  const w = elementWidth.value;
  const h = elementHeight.value;

  // Calculate rotation
  // center is (w/2, h/2)
  // map x from 0..w to -max..max
  const rotateY = ((x - w / 2) / (w / 2)) * maxRotation;
  // map y from 0..h to max..-max (inverted)
  const rotateX = -((y - h / 2) / (h / 2)) * maxRotation;

  return {
    transform: `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.02)`,
    transition: "transform 0.1s ease-out", // Fast response for mouse
  };
});

const spotlightStyle = computed(() => {
  const x = elementX.value;
  const y = elementY.value;

  return {
    background: `radial-gradient(circle at ${x}px ${y}px, rgba(255,255,255,0.15) 0%, transparent 80%)`,
  };
});

const iconComponent = computed(() => props.icon || Sparkles);
const iconGradient = computed(() => props.gradient);
</script>

<style scoped>
.tilt-card-wrapper {
  position: relative;
  height: 100%;
  transform-style: preserve-3d;
  will-change: transform;
}

.tilt-card-content {
  background: var(--card-bg);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid var(--card-border);
  border-radius: 20px;
  padding: 32px;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  position: relative;
  overflow: hidden; /* Contain spotlight */
  /* Remove default transition here, controlled by wrapper */
}

/* Add a subtle tech border glow on hover (via parent hover state logic handled by tilt) */

.spotlight-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  z-index: 2;
  transition: opacity 0.5s ease;
  opacity: 0;
}

.tilt-card-wrapper:hover .spotlight-overlay {
  opacity: 1;
}

.icon-wrapper {
  width: 56px;
  height: 56px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 24px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  box-shadow: 0 4px 20px -5px rgba(0, 0, 0, 0.3);
  position: relative;
  z-index: 3;
}

.feature-icon {
  width: 28px;
  height: 28px;
  color: var(--vp-c-brand-1);
}

h3 {
  font-size: 1.25rem;
  font-weight: 700;
  margin-bottom: 12px;
  color: var(--text);
  line-height: 1.3;
  position: relative;
  z-index: 3;
}

p {
  color: var(--text-muted);
  font-size: 0.95rem;
  line-height: 1.6;
  position: relative;
  z-index: 3;
}
</style>
