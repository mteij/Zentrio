/**
 * Offline watch-progress queue.
 *
 * When the player tries to save progress while offline, the POST fails.
 * This module queues those attempts in localStorage and flushes them
 * when the device reconnects (called by useOfflineMode.handleOnline).
 *
 * Only relevant on Tauri platforms where offline playback of downloaded
 * content is possible. Web has no offline playback so the queue stays empty.
 */

import { apiFetch } from './apiFetch'
import { createLogger } from '../utils/client-logger'

const log = createLogger('OfflineProgressQueue')
const QUEUE_KEY = 'zentrio-progress-queue'
const MAX_ENTRIES = 500 // safety cap to prevent unbounded growth

export interface ProgressQueueEntry {
  profileId: string
  metaId: string
  metaType: string
  season?: number
  episode?: number
  position: number
  duration: number
  title?: string
  poster?: string
  /** Unix ms — used to deduplicate: a later entry for the same item supersedes earlier ones */
  timestamp: number
}

function readQueue(): ProgressQueueEntry[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY)
    return raw ? (JSON.parse(raw) as ProgressQueueEntry[]) : []
  } catch {
    return []
  }
}

function writeQueue(entries: ProgressQueueEntry[]): void {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(entries))
  } catch {
    // localStorage quota exceeded — drop oldest entries
    const trimmed = entries.slice(-Math.floor(MAX_ENTRIES / 2))
    try { localStorage.setItem(QUEUE_KEY, JSON.stringify(trimmed)) } catch {}
  }
}

function entryKey(e: ProgressQueueEntry): string {
  return `${e.profileId}:${e.metaId}:${e.metaType}:${e.season ?? ''}:${e.episode ?? ''}`
}

/**
 * Queue a progress entry. If an entry for the same item already exists,
 * it is replaced with the newer position (we only need the latest position per item).
 */
export function queueProgress(entry: Omit<ProgressQueueEntry, 'timestamp'>): void {
  const queue = readQueue()
  const key = entryKey({ ...entry, timestamp: 0 })
  const filtered = queue.filter((e) => entryKey(e) !== key)
  const newEntry: ProgressQueueEntry = { ...entry, timestamp: Date.now() }
  const updated = [...filtered, newEntry].slice(-MAX_ENTRIES)
  writeQueue(updated)
  log.debug(`Queued progress for ${entry.metaId} at ${Math.round(entry.position)}s`)
}

/**
 * Flush all queued progress entries to the server.
 * Called by useOfflineMode when the device comes back online.
 * Entries are sent oldest-first; successfully sent entries are removed from the queue.
 */
export async function flushProgressQueue(): Promise<void> {
  const queue = readQueue()
  if (queue.length === 0) return

  log.info(`Flushing ${queue.length} queued progress entries`)
  const failed: ProgressQueueEntry[] = []

  for (const entry of queue) {
    try {
      const res = await apiFetch('/api/streaming/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileId: entry.profileId,
          metaId: entry.metaId,
          metaType: entry.metaType,
          season: entry.season,
          episode: entry.episode,
          position: entry.position,
          duration: entry.duration,
          title: entry.title,
          poster: entry.poster,
        }),
      })
      if (!res.ok) {
        // Server error — keep in queue for next flush attempt
        failed.push(entry)
        log.warn(`Progress flush failed with ${res.status} for ${entry.metaId}`)
      }
    } catch {
      // Network error again — keep remaining entries
      failed.push(entry)
      break // Stop flushing; we're likely still offline
    }
  }

  writeQueue(failed)
  if (failed.length === 0) {
    log.info('Progress queue flushed successfully')
  }
}
