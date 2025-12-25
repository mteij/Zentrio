<template>
  <div class="feature-card">
    <div class="icon-wrapper" :style="{ background: iconGradient }">
      <component :is="iconComponent" class="feature-icon" :stroke-width="1.5" />
    </div>
    <h3>{{ title }}</h3>
    <p>{{ description }}</p>
  </div>
</template>

<script setup>
import { computed } from "vue";
import { Sparkles } from "lucide-vue-next";

const props = defineProps({
  icon: {
    type: Object, // Expecting component
    required: false,
  },
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  delay: {
    type: Number,
    default: 0,
  },
  gradient: {
    type: String,
    default:
      "linear-gradient(135deg, rgba(229, 9, 20, 0.1), rgba(229, 9, 20, 0.05))",
  },
});

const iconComponent = computed(() => {
  return props.icon || Sparkles;
});

const iconGradient = computed(() => props.gradient);
</script>

<style scoped>
.feature-card {
  background: var(--card-bg);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid var(--card-border);
  border-radius: 20px;
  padding: 32px;
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  height: 100%;
  animation: fade-up 0.8s ease-out backwards;
  animation-delay: calc(var(--delay) * 1ms);
}

.feature-card:hover {
  transform: translateY(-8px);
  box-shadow: 0 20px 40px -10px rgba(0, 0, 0, 0.2);
  border-color: var(--vp-c-brand-soft);
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
}

p {
  color: var(--text-muted);
  font-size: 0.95rem;
  line-height: 1.6;
}

@keyframes fade-up {
  from {
    opacity: 0;
    transform: translateY(50px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
