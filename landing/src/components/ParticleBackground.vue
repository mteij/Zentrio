<template>
  <canvas ref="canvasRef" class="particle-canvas" :style="gradientStyle" />
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed, watch } from "vue";

const props = defineProps({
  color: {
    type: Array,
    default: () => [220, 38, 38],
  },
  density: {
    type: Number,
    default: 15000,
  },
  connectionDistance: {
    type: Number,
    default: 100,
  },
  showGradient: {
    type: Boolean,
    default: true,
  },
  seed: {
    type: Number,
    default: 12345,
  },
});

const canvasRef = ref(null);
const particles = ref([]);
const initialized = ref(false);
let animationId = null;

// Simple seeded random
function seededRandom(seed) {
  let value = seed;
  return () => {
    value = (value * 9301 + 49297) % 233280;
    return value / 233280;
  };
}

const resize = () => {
  if (!canvasRef.value) return;
  canvasRef.value.width = window.innerWidth;
  canvasRef.value.height = window.innerHeight;
};

const createParticles = () => {
  if (initialized.value && particles.value.length > 0) return;

  particles.value = [];
  const random = seededRandom(props.seed);
  const count = Math.floor(
    (window.innerWidth * window.innerHeight) / props.density
  );

  for (let i = 0; i < count; i++) {
    particles.value.push({
      x: random() * window.innerWidth,
      y: random() * window.innerHeight,
      vx: (random() - 0.5) * 0.3,
      vy: (random() - 0.5) * 0.3,
      size: random() * 2 + 0.5,
      opacity: random() * 0.4 + 0.1,
    });
  }
  initialized.value = true;
};

const animate = () => {
  if (!canvasRef.value) return;
  const ctx = canvasRef.value.getContext("2d");
  if (!ctx) return;

  ctx.clearRect(0, 0, canvasRef.value.width, canvasRef.value.height);

  const [r, g, b] = props.color;

  particles.value.forEach((p) => {
    p.x += p.vx;
    p.y += p.vy;

    if (p.x < 0) p.x = canvasRef.value.width;
    if (p.x > canvasRef.value.width) p.x = 0;
    if (p.y < 0) p.y = canvasRef.value.height;
    if (p.y > canvasRef.value.height) p.y = 0;

    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${p.opacity})`;
    ctx.fill();
  });

  // Draw connections
  const maxConnections = 50;
  let connections = 0;

  for (
    let i = 0;
    i < particles.value.length && connections < maxConnections;
    i++
  ) {
    const p1 = particles.value[i];
    for (
      let j = i + 1;
      j < particles.value.length && connections < maxConnections;
      j++
    ) {
      const p2 = particles.value[j];
      const dx = p1.x - p2.x;
      const dy = p1.y - p2.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < props.connectionDistance) {
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${
          0.08 * (1 - dist / props.connectionDistance)
        })`;
        ctx.stroke();
        connections++;
      }
    }
  }

  animationId = requestAnimationFrame(animate);
};

const gradientStyle = computed(() => {
  return props.showGradient
    ? {
        background:
          "linear-gradient(135deg, var(--vp-c-bg-alt) 0%, var(--vp-c-bg) 100%)",
      }
    : {};
});

onMounted(() => {
  resize();
  createParticles();
  animate();
  window.addEventListener("resize", resize);
});

onUnmounted(() => {
  cancelAnimationFrame(animationId);
  window.removeEventListener("resize", resize);
});

watch(
  () => props.color,
  () => {
    // Color changes automatically picked up in animate loop
  }
);
</script>

<style scoped>
.particle-canvas {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 0;
}
</style>
