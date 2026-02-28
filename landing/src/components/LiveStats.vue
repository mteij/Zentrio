<template>
  <div class="live-stats-wrapper">
    <div v-if="loading" class="stats-loading">
      <div class="spinner"></div>
      <span>Loading platform stats...</span>
    </div>

    <div v-else-if="error" class="stats-error">
      <span>Unable to load platform stats.</span>
    </div>

    <div v-else class="stats-grid">
      <div class="stat-card">
        <div class="stat-value">{{ formatNumber(stats.users) }}</div>
        <div class="stat-label">Active Users</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ formatNumber(stats.watched_items) }}</div>
        <div class="stat-label">Watched Items</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ formatNumber(stats.addons) }}</div>
        <div class="stat-label">Addons Installed</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ formatNumber(stats.profiles) }}</div>
        <div class="stat-label">User Profiles</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";

const loading = ref(true);
const error = ref(null);
const stats = ref({
  users: 0,
  watched_items: 0,
  addons: 0,
  profiles: 0,
});

const formatNumber = (num) => {
  return new Intl.NumberFormat("en-US").format(num);
};

const fetchStats = async () => {
  loading.value = true;
  error.value = null;

  try {
    const response = await fetch("https://app.zentrio.eu/api/health", {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    if (data && data.stats) {
      stats.value = data.stats;
    }
  } catch (err) {
    console.error("Failed to fetch stats:", err);
    error.value = err.message;
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  // Defer non-critical stats API call to improve LCP
  // Use requestIdleCallback if available, otherwise setTimeout
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => fetchStats(), { timeout: 1500 });
  } else {
    setTimeout(fetchStats, 50);
  }
});
</script>

<style scoped>
.live-stats-wrapper {
  width: 100%;
  margin: 0 auto;
}

.stats-loading,
.stats-error {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 40px;
  color: var(--text-muted);
  background: var(--bg-alt);
  border: 1px solid var(--border);
  border-radius: 16px;
}

.spinner {
  width: 20px;
  height: 20px;
  border: 2px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
}

.stat-card {
  background: linear-gradient(
    180deg,
    var(--bg-alt) 0%,
    rgba(20, 20, 23, 0.4) 100%
  );
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 32px 24px;
  text-align: center;
  transition:
    transform 0.3s ease,
    box-shadow 0.3s ease,
    border-color 0.3s ease;
}

.stat-card:hover {
  transform: translateY(-5px);
  border-color: var(--border-hover);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
}

.stat-value {
  font-size: 2.5rem;
  font-weight: 800;
  color: var(--text);
  margin-bottom: 8px;
  letter-spacing: -0.05em;
  background: linear-gradient(135deg, #ffffff 0%, #a0a0a5 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.stat-label {
  font-size: 0.95rem;
  color: var(--text-muted);
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

@media (max-width: 900px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 480px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }
}
</style>
