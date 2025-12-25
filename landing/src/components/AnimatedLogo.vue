<template>
  <div class="logo-container">
    <!-- Outer pulsing ring -->
    <div class="ring ring-outer" />

    <!-- Middle pulsing ring -->
    <div class="ring ring-middle" />

    <!-- Soft glow halo -->
    <div class="glow-halo" />

    <!-- Orbiting dot 1 -->
    <div class="orbit orbit-1">
      <div class="dot dot-1" />
    </div>

    <!-- Orbiting dot 2 (opposite direction) -->
    <div class="orbit orbit-2">
      <div class="dot dot-2" />
    </div>

    <!-- Orbiting dot 3 -->
    <div class="orbit orbit-3">
      <div class="dot dot-3" />
    </div>

    <!-- The logo itself - floating freely -->
    <img src="/icon-192.png" alt="Zentrio" class="main-logo" />
  </div>
</template>

<script setup>
// Pure CSS implementation for better build stability
</script>

<style scoped>
.logo-container {
  position: relative;
  width: 200px;
  height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ring {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  pointer-events: none;
  animation: pulse 3s ease-in-out infinite;
}

.ring-outer {
  border: 2px solid rgba(220, 38, 38, 0.3);
  margin: -20px;
  animation-duration: 4s;
}

.ring-middle {
  border: 1px solid rgba(220, 38, 38, 0.4);
  margin: -10px;
  animation-delay: 0.5s;
}

.glow-halo {
  position: absolute;
  inset: 0;
  background-color: rgb(239, 68, 68);
  border-radius: 50%;
  filter: blur(40px);
  margin: -30px;
  z-index: -1;
  opacity: 0.4;
  animation: breathe 4s ease-in-out infinite;
}

.orbit {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.orbit-1 {
  margin: -25px;
  animation: spin 8s linear infinite;
}
.orbit-2 {
  margin: -40px;
  animation: spin 12s linear infinite reverse;
}
.orbit-3 {
  margin: -55px;
  animation: spin 15s linear infinite;
}

.dot {
  position: absolute;
  border-radius: 50%;
}

.dot-1 {
  top: 0;
  left: 50%;
  margin-left: -4px;
  width: 8px;
  height: 8px;
  background-color: rgb(248, 113, 113);
  box-shadow: 0 10px 15px -3px rgba(239, 68, 68, 0.5);
}

.dot-2 {
  bottom: 0;
  left: 50%;
  margin-left: -3px;
  width: 6px;
  height: 6px;
  background-color: rgba(252, 165, 165, 0.7);
}

.dot-3 {
  left: 0;
  top: 50%;
  margin-top: -2px;
  width: 4px;
  height: 4px;
  background-color: rgba(254, 202, 202, 0.5);
}

.main-logo {
  position: relative;
  width: 100%;
  height: 100%;
  object-fit: contain;
  filter: drop-shadow(0 0 30px rgba(220, 38, 38, 0.5));
  z-index: 10;
  animation: float 6s ease-in-out infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 0.3;
    transform: scale(1);
  }
  50% {
    opacity: 0.1;
    transform: scale(1.1);
  }
}

@keyframes breathe {
  0%,
  100% {
    opacity: 0.4;
    transform: scale(1);
  }
  50% {
    opacity: 0.6;
    transform: scale(1.05);
  }
}

@keyframes float {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
