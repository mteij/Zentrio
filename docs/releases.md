---
layout: page
title: Releases
---

# Releases

All Zentrio releases from GitHub, including direct Android APK downloads when available.

This page fetches data from `github.com/MichielEijpe/Zentrio` at runtime. If anything fails, use the GitHub releases page directly:

- https://github.com/MichielEijpe/Zentrio/releases

<script setup lang="ts">
import { onMounted, ref } from 'vue'

interface GithubAsset {
  id: number
  name: string
  browser_download_url: string
  content_type?: string
}

interface GithubRelease {
  id: number
  name: string | null
  tag_name: string
  body: string | null
  html_url: string
  published_at: string
  draft: boolean
  prerelease: boolean
  assets: GithubAsset[]
}

const loading = ref(true)
const error = ref<string | null>(null)
const releases = ref<GithubRelease[]>([])

const owner = 'MichielEijpe'
const repo = 'Zentrio'

function findApkAsset(assets: GithubAsset[]): GithubAsset | null {
  return (
    assets.find(a => a.name.toLowerCase().endsWith('.apk')) ||
    assets.find(a => a.name.toLowerCase().includes('android') && a.name.toLowerCase().endsWith('.apk')) ||
    null
  )
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    })
  } catch {
    return iso
  }
}

function shortenBody(body: string | null, maxChars = 260): string {
  if (!body) return ''
  if (body.length <= maxChars) return body
  return body.slice(0, maxChars).trimEnd() + '…'
}

onMounted(async () => {
  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases`)
    if (!res.ok) {
      throw new Error(`GitHub API returned ${res.status}`)
    }
    const data = (await res.json()) as GithubRelease[]
    releases.value = data
  } catch (e: any) {
    error.value = e?.message || 'Failed to load releases.'
  } finally {
    loading.value = false
  }
})
</script>

<div class="releases-page">
  <div v-if="loading" class="releases-state">
    <p>Loading releases…</p>
  </div>

  <div v-else-if="error" class="releases-state releases-error">
    <p>Could not load releases from GitHub.</p>
    <p class="releases-hint">
      You can always use the GitHub releases page directly:
      <a href="https://github.com/MichielEijpe/Zentrio/releases" target="_blank" rel="noreferrer">
        github.com/MichielEijpe/Zentrio/releases
      </a>
    </p>
  </div>

  <div v-else>
    <div v-if="!releases.length" class="releases-state">
      <p>No releases found.</p>
    </div>

    <div v-else class="release-list">
      <article
        v-for="release in releases"
        :key="release.id"
        class="release-card"
      >
        <header class="release-header">
          <div class="release-title">
            <h2>{{ release.name || release.tag_name }}</h2>
            <p class="release-meta">
              <span class="release-tag">{{ release.tag_name }}</span>
              <span class="release-date">{{ formatDate(release.published_at) }}</span>
              <span
                v-if="release.prerelease || release.draft"
                class="release-label"
              >
                {{ release.draft ? 'Draft' : 'Pre‑release' }}
              </span>
            </p>
          </div>
          <a
            class="release-link"
            :href="release.html_url"
            target="_blank"
            rel="noreferrer"
          >
            View on GitHub
          </a>
        </header>

        <p v-if="release.body" class="release-body">
          {{ shortenBody(release.body) }}
        </p>

        <div class="release-actions">
          <a
            v-if="findApkAsset(release.assets)"
            class="apk-button"
            :href="findApkAsset(release.assets)!.browser_download_url"
            target="_blank"
            rel="noreferrer"
          >
            Download Android APK
          </a>
          <span
            v-else
            class="apk-missing"
          >
            No Android APK attached to this release.
          </span>
        </div>
      </article>
    </div>
  </div>
</div>

<style scoped>
.releases-page {
  max-width: 880px;
  margin: 0 auto;
  padding: 2rem 1.25rem 3rem;
}

.release-list {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.release-card {
  border-radius: 0.75rem;
  padding: 1.25rem 1.5rem;
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-bg-soft-up);
}

.release-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.75rem;
}

.release-title h2 {
  margin: 0 0 0.25rem;
  font-size: 1rem;
}

.release-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  font-size: 0.8rem;
  opacity: 0.8;
}

.release-tag {
  padding: 0.1rem 0.4rem;
  border-radius: 999px;
  background: var(--vp-c-bg-soft-up);
}

.release-label {
  padding: 0.1rem 0.4rem;
  border-radius: 999px;
  background: var(--vp-c-warning-soft);
  color: var(--vp-c-warning-1);
}

.release-date {
  color: var(--vp-c-text-2);
}

.release-link {
  font-size: 0.8rem;
}

.release-body {
  margin: 0.75rem 0 0.75rem;
  white-space: pre-line;
  font-size: 0.9rem;
}

.release-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
}

.apk-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem 0.9rem;
  border-radius: 999px;
  background: var(--vp-c-brand-1);
  color: #fff;
  font-size: 0.85rem;
  text-decoration: none;
}

.apk-button:hover {
  background: var(--vp-c-brand-2);
}

.apk-missing {
  font-size: 0.8rem;
  color: var(--vp-c-text-2);
}

.releases-state {
  text-align: center;
  padding: 3rem 1rem;
  color: var(--vp-c-text-2);
}

.releases-error p {
  margin: 0.25rem 0;
}

.releases-hint a {
  text-decoration: underline;
}

@media (max-width: 640px) {
  .release-card {
    padding: 1rem 1.1rem;
  }

  .release-header {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>