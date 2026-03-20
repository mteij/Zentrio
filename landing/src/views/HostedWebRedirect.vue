<template>
  <div class="redirect-view">
    <div class="redirect-shell">
      <p class="eyebrow">Official Hosted Service</p>
      <h1 class="title">Opening Zentrio Web</h1>
      <p class="subtitle">
        You are leaving <strong>zentrio.eu</strong> and opening the official hosted
        Zentrio Web service at <strong>{{ appHost }}</strong>.
      </p>

      <div class="notice-card">
        <p class="notice-title">Before you continue</p>
        <p class="notice-copy">
          The official hosted service is covered by the
          <a :href="legalMeta.tosUrl">Terms of Service</a> and
          <a :href="legalMeta.privacyUrl">Privacy Policy</a> published on this
          site. Self-hosted Zentrio servers are operated independently and may use
          different legal terms, privacy practices, and deletion processes.
        </p>
      </div>

      <div class="countdown-card">
        <div class="countdown-row">
          <div>
            <p class="countdown-label">Automatic redirect</p>
            <p class="countdown-value">{{ secondsLeft }} seconds</p>
          </div>
          <div class="countdown-pill">{{ progressPercent }}%</div>
        </div>
        <div class="progress-track" aria-hidden="true">
          <div class="progress-bar" :style="{ width: `${progressPercent}%` }"></div>
        </div>
      </div>

      <div class="actions">
        <a :href="legalMeta.webAppUrl" class="btn btn-primary btn-lg">Continue to Zentrio Web</a>
        <router-link to="/" class="btn btn-secondary btn-lg">Stay on zentrio.eu</router-link>
      </div>

      <p class="footer-note">
        Self-hosting instead?
        <a :href="legalMeta.docsUrl">Read the self-hosting documentation</a>.
      </p>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from "vue";
import { legalMeta } from "../legal";

const appHost = new URL(legalMeta.webAppUrl).host;
const redirectDelaySeconds = 10;
const secondsLeft = ref(redirectDelaySeconds);

let countdownId = null;
let redirectId = null;

const progressPercent = computed(() => {
  return Math.round(((redirectDelaySeconds - secondsLeft.value) / redirectDelaySeconds) * 100);
});

onMounted(() => {
  countdownId = window.setInterval(() => {
    secondsLeft.value = Math.max(secondsLeft.value - 1, 0);
  }, 1000);

  redirectId = window.setTimeout(() => {
    window.location.href = legalMeta.webAppUrl;
  }, redirectDelaySeconds * 1000);
});

onUnmounted(() => {
  if (countdownId !== null) {
    window.clearInterval(countdownId);
  }
  if (redirectId !== null) {
    window.clearTimeout(redirectId);
  }
});
</script>

<style scoped>
.redirect-view {
  min-height: calc(100vh - 72px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px 24px 48px;
}

.redirect-shell {
  width: min(100%, 860px);
  padding: 40px;
  border-radius: 28px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background:
    radial-gradient(circle at top left, rgba(229, 9, 20, 0.16), transparent 32%),
    linear-gradient(180deg, rgba(20, 20, 23, 0.96), rgba(10, 10, 12, 0.96));
  box-shadow: 0 28px 80px rgba(0, 0, 0, 0.35);
}

.eyebrow {
  color: var(--accent);
  font-size: 0.82rem;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  margin-bottom: 14px;
}

.title {
  font-size: clamp(2.4rem, 5vw, 4.25rem);
  line-height: 0.98;
  letter-spacing: -0.04em;
  margin-bottom: 18px;
}

.subtitle {
  color: var(--text-muted);
  font-size: 1.08rem;
  line-height: 1.75;
  max-width: 760px;
}

.subtitle strong {
  color: var(--text);
}

.notice-card,
.countdown-card {
  margin-top: 24px;
  padding: 22px 24px;
  border-radius: 18px;
  border: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.03);
}

.notice-title,
.countdown-label {
  color: var(--text);
  font-size: 0.95rem;
  font-weight: 700;
  margin-bottom: 8px;
}

.notice-copy {
  color: var(--text-muted);
  line-height: 1.75;
}

.notice-copy a,
.footer-note a {
  color: var(--text);
}

.countdown-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 14px;
}

.countdown-value {
  color: var(--text);
  font-size: 1.3rem;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.countdown-pill {
  min-width: 70px;
  padding: 10px 14px;
  border-radius: 999px;
  background: rgba(229, 9, 20, 0.12);
  border: 1px solid rgba(229, 9, 20, 0.28);
  color: #ffd7d9;
  text-align: center;
  font-size: 0.92rem;
  font-weight: 700;
}

.progress-track {
  height: 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  overflow: hidden;
}

.progress-bar {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #e50914 0%, #ff5a31 100%);
  transition: width 0.3s ease;
}

.actions {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  margin-top: 28px;
}

.footer-note {
  margin-top: 20px;
  color: var(--text-muted);
  line-height: 1.7;
}

@media (max-width: 768px) {
  .redirect-view {
    min-height: auto;
    padding: 20px 16px 36px;
  }

  .redirect-shell {
    padding: 26px 22px;
    border-radius: 22px;
  }

  .actions {
    flex-direction: column;
  }

  .countdown-row {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
