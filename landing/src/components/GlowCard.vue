<template>
  <div ref="cardRef" class="glow-card" :class="{ 'hover-active': !isOutside }">
    <div class="glow-effect" :style="glowStyle"></div>

    <div class="card-content">
      <div class="icon-box" :style="{ background: gradient }">
        <component :is="icon" class="icon-svg" />
      </div>

      <h3 class="title">{{ title }}</h3>
      <p class="description">{{ description }}</p>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from "vue";
import { useMouseInElement } from "@vueuse/core";

const props = defineProps({
  icon: Object,
  title: String,
  description: String,
  gradient: String,
});

const cardRef = ref(null);
const { elementX, elementY, isOutside } = useMouseInElement(cardRef);

const glowStyle = computed(() => {
  if (isOutside.value) return { opacity: 0 };

  const x = elementX.value;
  const y = elementY.value;

  return {
    opacity: 1,
    background: `radial-gradient(
      600px circle at ${x}px ${y}px,
      rgba(255, 255, 255, 0.1),
      transparent 40%
    )`,
  };
});
</script>

<style scoped>
.glow-card {
  position: relative;
  background: rgba(20, 20, 20, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.08); /* Clean, subtle border */
  border-radius: 12px;
  overflow: hidden;
  transition: transform 0.2s ease, border-color 0.2s ease;
  height: 100%;
}

.glow-card:hover {
  border-color: rgba(255, 255, 255, 0.15);
  transform: translateY(-2px);
}

.glow-effect {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 1;
  transition: opacity 0.5s ease;
}

.card-content {
  position: relative;
  z-index: 2;
  padding: 32px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
}

.icon-box {
  width: 48px;
  height: 48px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 8px;
  /* Gradient passed via prop */
}

.icon-svg {
  width: 24px;
  height: 24px;
  color: white;
  opacity: 0.9;
}

.title {
  color: #fff;
  font-size: 1.1rem;
  font-weight: 600;
  margin: 0;
}

.description {
  color: #a1a1aa; /* Zinc-400 equivalent for clean look */
  font-size: 0.95rem;
  line-height: 1.6;
  margin: 0;
}
</style>
