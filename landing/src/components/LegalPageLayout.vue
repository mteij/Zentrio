<template>
  <div class="legal-view">
    <div class="container">
      <header class="page-header">
        <p class="eyebrow">Hosted Zentrio Service</p>
        <h1 class="page-title">{{ title }}</h1>
        <p class="page-subtitle">
          Effective as of {{ legalMeta.effectiveDate }}.
        </p>
      </header>

      <section class="scope-card" aria-labelledby="scope-title">
        <p class="scope-label" id="scope-title">{{ hostedScopeTitle }}</p>
        <p class="scope-summary">{{ hostedScopeSummary }}</p>
        <p class="scope-disclaimer">{{ selfHostedDisclaimer }}</p>
      </section>

      <section class="legal-content">
        <slot />
      </section>
    </div>
  </div>
</template>

<script setup>
import {
  legalMeta,
  hostedScopeTitle,
  hostedScopeSummary,
  selfHostedDisclaimer,
} from "../legal";

defineProps({
  title: {
    type: String,
    required: true,
  },
});
</script>

<style scoped>
.legal-view {
  padding-top: 120px;
  padding-bottom: 80px;
  min-height: 100vh;
}

.page-header {
  text-align: center;
  margin-bottom: 32px;
}

.eyebrow {
  color: var(--accent);
  font-size: 0.85rem;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  margin-bottom: 12px;
}

.page-title {
  font-size: 3.5rem;
  font-weight: 800;
  margin-bottom: 16px;
  letter-spacing: -0.03em;
}

.page-subtitle {
  color: var(--text-muted);
  font-size: 1.1rem;
}

.scope-card {
  max-width: 900px;
  margin: 0 auto 24px;
  padding: 24px 28px;
  border: 1px solid rgba(229, 9, 20, 0.3);
  border-radius: 16px;
  background:
    linear-gradient(135deg, rgba(229, 9, 20, 0.14), rgba(255, 255, 255, 0.03)),
    var(--bg-alt);
  box-shadow: 0 20px 45px rgba(0, 0, 0, 0.2);
}

.scope-label {
  color: var(--text);
  font-size: 0.95rem;
  font-weight: 700;
  margin-bottom: 8px;
}

.scope-summary,
.scope-disclaimer {
  color: var(--text-muted);
  font-size: 1rem;
  line-height: 1.7;
}

.scope-summary {
  margin-bottom: 10px;
}

.legal-content {
  background: var(--bg-alt);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 40px;
  max-width: 900px;
  margin: 0 auto;
}

:deep(.legal-section) {
  margin-bottom: 40px;
}

:deep(.legal-section:last-child) {
  margin-bottom: 0;
}

:deep(.legal-section h2) {
  font-size: 1.75rem;
  margin-bottom: 16px;
  color: var(--text);
  border-bottom: 1px solid var(--border);
  padding-bottom: 8px;
}

:deep(.legal-section p) {
  color: var(--text-muted);
  margin-bottom: 16px;
  font-size: 1.03rem;
  line-height: 1.75;
}

:deep(.legal-section p:last-child) {
  margin-bottom: 0;
}

:deep(.legal-section ul) {
  padding-left: 24px;
  margin-top: 12px;
  margin-bottom: 16px;
  color: var(--text-muted);
  font-size: 1.03rem;
  line-height: 1.75;
}

:deep(.legal-section li) {
  margin-bottom: 8px;
}

:deep(.legal-section strong) {
  color: var(--text);
}

:deep(.legal-section a) {
  color: var(--text);
}

@media (max-width: 768px) {
  .page-title {
    font-size: 2.8rem;
  }

  .scope-card,
  .legal-content {
    padding: 24px;
  }

  :deep(.legal-section h2) {
    font-size: 1.45rem;
  }
}
</style>
