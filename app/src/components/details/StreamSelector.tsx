// Stream Selector Component
// Extracted from Details.tsx
import { Check, Download, HardDrive, Play, WifiOff, Wifi, XCircle, Zap } from 'lucide-react'
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { SkeletonStreamList } from '../../components'
import { CompactStreamItem } from '../../components/features/CompactStreamItem'
import { StreamRefreshButton } from '../../components/features/StreamRefreshButton'
import type { AddonLoadingState } from '../../hooks/useStreamLoader'
import { useOfflineMode } from '../../hooks/useOfflineMode'
import { isTauri } from '../../lib/auth-client'
import { cacheTopStream } from '../../lib/topStreamCache'
import type { DownloadRecord } from '../../services/downloads/download-service'
import { useDownloadStore } from '../../stores/downloadStore'
import type { MetaDetail, Stream } from '../../services/addons/types'
import styles from '../../styles/Streaming.module.css'

// Helper to parse stream information
const parseStreamInfo = (stream: Stream) => {
  const name = stream.name || ''
  const title = stream.title || ''
  const desc = stream.description || ''
  const combined = `${name} ${title} ${desc}`.toLowerCase()

  // Resolution
  let resolution = ''
  if (combined.includes('4k') || combined.includes('2160p')) resolution = '4K'
  else if (combined.includes('1080p')) resolution = '1080p'
  else if (combined.includes('720p')) resolution = '720p'
  else if (combined.includes('480p')) resolution = '480p'

  // Size
  const sizeMatch = combined.match(/(\d+(?:\.\d+)?)\s*(gb|mb)/i)
  let size = ''
  if (sizeMatch) {
    const val = parseFloat(sizeMatch[1])
    const unit = sizeMatch[2].toUpperCase()
    size = `${val} ${unit}`
  }

  // Cached status
  // Use the same conservative heuristics as stream-processor: bracket patterns like [RD+], [TB+], etc.
  const uncachedIndicators = ['⬇️', '⬇', '⏳', 'uncached']
  const isExplicitlyUncached = uncachedIndicators.some(
    (indicator) =>
      combined.includes(indicator.toLowerCase()) ||
      name.includes(indicator) ||
      title.includes(indicator)
  )
  const bracketCachedPattern = /\[[a-z]{1,4}\+\]/i
  const isCached =
    !isExplicitlyUncached &&
    (combined.includes('cached') ||
      combined.includes('⚡') ||
      combined.includes('✓') ||
      combined.includes('instant') ||
      combined.includes('your media') ||
      bracketCachedPattern.test(name) ||
      bracketCachedPattern.test(title))

  // HDR/DV
  const hasHDR = combined.includes('hdr')
  const hasDV = combined.includes('dv') || combined.includes('dolby vision')

  return { resolution, size, isCached, hasHDR, hasDV }
}

interface StreamSelectorProps {
  meta: MetaDetail
  streams: any[]
  filteredStreams: { stream: Stream; addon: any }[]
  selectedEpisode: { season: number; number: number; title: string } | null
  addonStatuses: Map<string, AddonLoadingState>
  selectedAddon: string | null
  setSelectedAddon: (id: string | null) => void
  streamsLoading: boolean
  cacheStatus: { cacheAgeMs?: number } | null
  streamDisplaySettings: {
    streamDisplayMode: 'classic' | 'compact-simple' | 'compact-advanced'
    showAddonName: boolean
    showDescription: boolean
  }
  profileId: string
  onRefresh: () => void
  onPlay: (stream: Stream) => void
  onDownload?: (stream: Stream) => void
  onBack: () => void
}

export function StreamSelector({
  meta,
  streams,
  filteredStreams,
  selectedEpisode,
  addonStatuses,
  selectedAddon,
  setSelectedAddon,
  streamsLoading,
  cacheStatus,
  streamDisplaySettings,
  profileId,
  onRefresh,
  onPlay,
  onDownload,
}: StreamSelectorProps) {
  const navigate = useNavigate()
  const { isOnline } = useOfflineMode(profileId)
  const downloads = useDownloadStore((s) => s.downloads)

  // Find a completed download that matches the currently displayed content.
  // For series, match by season + episode; for movies, match by mediaId only.
  const matchedDownload: DownloadRecord | undefined = isTauri()
    ? downloads.find((d) => {
        if (d.status !== 'completed' || !d.filePath) return false
        if (d.mediaId !== meta.id) return false
        if (meta.type === 'series') {
          if (!selectedEpisode) return false
          return d.season === selectedEpisode.season && d.episode === selectedEpisode.number
        }
        return true
      })
    : undefined

  // When offline on a Tauri device, replace the full stream list with a focused offline UI.
  const showOfflineView = isTauri() && !isOnline

  const handlePlayDownload = async (record: DownloadRecord) => {
    try {
      const { convertFileSrc } = await import('@tauri-apps/api/core')
      const url = convertFileSrc(record.filePath!)
      const subtitles = (record.subtitlePaths ?? []).map((s) => ({
        url: convertFileSrc(s.path),
        lang: s.lang,
      }))
      navigate(`/streaming/${profileId}/player`, {
        state: {
          stream: { url, type: 'video/mp4', subtitles: subtitles.length ? subtitles : undefined },
          meta: {
            id: record.mediaId,
            type: record.mediaType,
            name: record.title,
            poster: record.posterPath,
            season: record.season,
            episode: record.episode,
          },
        },
      })
    } catch {
      // Fallback: let it fail visibly rather than silently
      navigate(`/streaming/${profileId}/player`, {
        state: {
          stream: { url: `file://${record.filePath}`, type: 'video/mp4' },
          meta: {
            id: record.mediaId,
            type: record.mediaType,
            name: record.title,
            poster: record.posterPath,
          },
        },
      })
    }
  }

  // Cache the top stream in sessionStorage so the download button can pick up
  // the resolved URL without re-requesting streams.
  // Writes both a generic key and a per-episode key (for series).
  useEffect(() => {
    if (filteredStreams && filteredStreams.length > 0) {
      const top = filteredStreams[0]
      if (top.stream.url) {
        cacheTopStream(
          meta.id,
          { url: top.stream.url, addonId: top.addon?.id || '' },
          selectedEpisode?.season,
          selectedEpisode?.number
        )
      }
    }
  }, [filteredStreams, meta.id, selectedEpisode])

  if (showOfflineView) {
    return (
      <div className={styles.streamsContainer}>
        {meta.type === 'series' && selectedEpisode && (
          <h2
            style={{
              margin: '0 0 20px',
              fontSize: '1.1rem',
              color: 'rgba(255,255,255,0.75)',
              fontWeight: 500,
            }}
          >
            S{selectedEpisode.season}:E{selectedEpisode.number} — {selectedEpisode.title}
          </h2>
        )}
        {matchedDownload ? (
          /* Content is downloaded — show a single play button */
          <div className="flex flex-col items-center justify-center py-10 px-4 bg-white/5 rounded-xl border border-white/5 text-center gap-4">
            <div className="bg-green-500/10 p-4 rounded-full">
              <Play size={32} className="text-green-400" />
            </div>
            <div>
              <h3 className="text-lg font-medium text-white mb-1">Downloaded &amp; ready</h3>
              <p className="text-sm text-gray-400">
                You&apos;re offline, but this is available locally.
              </p>
            </div>
            <button
              className={`${styles.actionBtn} ${styles.btnPrimaryGlass}`}
              style={{ padding: '10px 28px', display: 'flex', alignItems: 'center', gap: '8px' }}
              onClick={() => handlePlayDownload(matchedDownload)}
            >
              <Play size={16} fill="currentColor" />
              Play Downloaded Version
            </button>
          </div>
        ) : (
          /* Not downloaded — guide user to Downloads */
          <div className="flex flex-col items-center justify-center py-16 px-4 bg-white/5 rounded-xl border border-white/5 text-center">
            <div className="bg-white/10 p-4 rounded-full mb-4">
              <WifiOff size={32} className="text-gray-400 opacity-50" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">You&apos;re offline</h3>
            <p className="text-sm text-gray-400 max-w-md mb-5">
              Streaming requires a connection. Download this content while online to watch it
              offline.
            </p>
            <button
              onClick={() => navigate(`/streaming/${profileId}/downloads`)}
              className={`${styles.actionBtn} ${styles.btnSecondaryGlass}`}
              style={{ padding: '8px 20px', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Download size={15} />
              Go to Downloads
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={styles.streamsContainer}>
      {meta.type === 'series' && selectedEpisode && (
        <h2
          style={{
            margin: '0 0 20px',
            fontSize: '1.1rem',
            color: 'rgba(255,255,255,0.75)',
            fontWeight: 500,
          }}
        >
          S{selectedEpisode.season}:E{selectedEpisode.number} — {selectedEpisode.title}
        </h2>
      )}

      {/* Unified Addon Status + Controls Bar */}
      {(streamsLoading || addonStatuses.size > 0 || streams.length > 0) && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            marginBottom: '20px',
            flexWrap: 'wrap',
          }}
        >
          {/* Left side: Source count + addon chips */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            {/* Play Best button for series */}
            {meta.type === 'series' && filteredStreams && filteredStreams.length > 0 && (
              <button
                className={`${styles.actionBtn} ${styles.btnPrimaryGlass}`}
                style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}
                onClick={() => onPlay(filteredStreams[0].stream)}
              >
                <Play size={16} fill="currentColor" />
                Play Best
              </button>
            )}

            {/* Source count */}
            <span
              style={{
                fontSize: '0.85rem',
                color: '#9ca3af',
                fontWeight: 500,
              }}
            >
              {filteredStreams.length > 0
                ? `${filteredStreams.length} sources`
                : streamsLoading
                  ? 'Loading...'
                  : 'No sources'}
            </span>

            {/* Subtle separator */}
            {addonStatuses.size > 0 && <span style={{ color: 'rgba(255,255,255,0.2)' }}>•</span>}

            {/* Addon chips - subtle inline pills */}
            {Array.from(addonStatuses.values()).map((addon) => (
              <button
                key={addon.id}
                onClick={() => {
                  if (addon.status === 'done' || addon.status === 'error') {
                    setSelectedAddon(selectedAddon === addon.id ? null : addon.id)
                  }
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '4px 10px',
                  borderRadius: '20px',
                  border: 'none',
                  cursor:
                    addon.status === 'done' || addon.status === 'error' ? 'pointer' : 'default',
                  background:
                    selectedAddon === addon.id
                      ? addon.status === 'error'
                        ? 'rgba(239, 68, 68, 0.12)'
                        : 'rgba(139, 92, 246, 0.25)'
                      : 'rgba(255, 255, 255, 0.06)',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  color:
                    addon.status === 'error'
                      ? '#f87171'
                      : selectedAddon === addon.id
                        ? '#c4b5fd'
                        : addon.status === 'done'
                          ? 'rgba(255, 255, 255, 0.7)'
                          : 'rgba(255, 255, 255, 0.5)',
                  transition: 'all 0.15s ease',
                  outline:
                    selectedAddon === addon.id
                      ? addon.status === 'error'
                        ? '1px solid rgba(239, 68, 68, 0.35)'
                        : '1px solid rgba(139, 92, 246, 0.5)'
                      : 'none',
                }}
              >
                {addon.status === 'loading' && (
                  <span
                    style={{
                      width: '10px',
                      height: '10px',
                      border: '1.5px solid currentColor',
                      borderTopColor: 'transparent',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite',
                      display: 'inline-block',
                    }}
                  />
                )}
                {addon.status === 'done' && <Check size={10} strokeWidth={3} />}
                {addon.status === 'error' && <span style={{ fontSize: '0.6rem' }}>✕</span>}
                <span>{addon.name}</span>
                {addon.status === 'done' && addon.streamCount !== undefined && (
                  <span style={{ opacity: 0.6 }}>{addon.streamCount}</span>
                )}
              </button>
            ))}
          </div>

          {/* Right side: Refresh button */}
          <StreamRefreshButton
            onRefresh={onRefresh}
            isLoading={streamsLoading}
            cacheAgeMs={cacheStatus?.cacheAgeMs}
          />
        </div>
      )}

      {selectedAddon && addonStatuses.get(selectedAddon)?.status === 'error' ? (
        <div
          style={{
            padding: '16px 20px',
            background: 'rgba(239, 68, 68, 0.07)',
            border: '1px solid rgba(239, 68, 68, 0.18)',
            borderRadius: '10px',
            display: 'flex',
            gap: '14px',
            alignItems: 'flex-start',
          }}
        >
          <XCircle size={18} style={{ color: '#f87171', flexShrink: 0, marginTop: '1px' }} />
          <div>
            <div
              style={{
                color: '#f87171',
                fontWeight: 500,
                fontSize: '0.875rem',
                marginBottom: '4px',
              }}
            >
              {addonStatuses.get(selectedAddon)?.name} failed to load streams
            </div>
            <div
              style={{
                color: 'rgba(255,255,255,0.45)',
                fontSize: '0.78rem',
                fontFamily: 'monospace',
                wordBreak: 'break-all',
              }}
            >
              {addonStatuses.get(selectedAddon)?.error || 'Unknown error'}
            </div>
          </div>
        </div>
      ) : streamsLoading && streams.length === 0 ? (
        <SkeletonStreamList />
      ) : filteredStreams && filteredStreams.length > 0 ? (
        /* Render based on displayMode setting */
        <div className="streams-list-wrapper">
          <div
            className={styles.streamList}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: streamDisplaySettings.streamDisplayMode === 'classic' ? '12px' : '6px',
            }}
          >
            {streamDisplaySettings.streamDisplayMode !== 'classic'
              ? /* Compact modes - tag-based display */
                filteredStreams.map((item, idx) => (
                  <CompactStreamItem
                    key={idx}
                    item={item}
                    onClick={() => onPlay(item.stream)}
                    index={idx}
                    showAddonName={streamDisplaySettings.showAddonName}
                    mode={
                      streamDisplaySettings.streamDisplayMode === 'compact-advanced'
                        ? 'advanced'
                        : 'simple'
                    }
                    onDownload={onDownload ? () => onDownload(item.stream) : undefined}
                  />
                ))
              : /* Classic mode - addon title + description */
                filteredStreams.map(({ stream, addon }, idx) => {
                  const info = parseStreamInfo(stream)
                  return (
                    <div
                      key={idx}
                      className={`${styles.streamItem} ${info.isCached ? styles.streamCached : ''}`}
                      onClick={() => onPlay(stream)}
                    >
                      <div className={styles.streamHeader}>
                        <div className={styles.streamName}>
                          {stream.title || stream.name || `Stream ${idx + 1}`}
                        </div>
                        <div className={styles.streamBadges}>
                          {streamDisplaySettings.showAddonName && (
                            <span
                              className={styles.streamBadge}
                              style={{ background: 'rgba(255,255,255,0.1)', fontSize: '0.7rem' }}
                            >
                              {addon.name}
                            </span>
                          )}
                          {info.isCached && (
                            <span
                              className={`${styles.streamBadge} ${styles.badgeCached}`}
                              title="Cached"
                            >
                              <Zap size={12} />
                            </span>
                          )}
                          {info.resolution && (
                            <span className={`${styles.streamBadge} ${styles.badgeResolution}`}>
                              {info.resolution}
                            </span>
                          )}
                          {info.size && (
                            <span className={`${styles.streamBadge} ${styles.badgeSize}`}>
                              <HardDrive size={10} />
                              {info.size}
                            </span>
                          )}
                          {info.hasHDR && (
                            <span className={`${styles.streamBadge} ${styles.badgeHDR}`}>HDR</span>
                          )}
                          {info.hasDV && (
                            <span className={`${styles.streamBadge} ${styles.badgeDV}`}>DV</span>
                          )}
                          {onDownload && (
                            <button
                              className={styles.streamDownloadBtn}
                              onClick={(e) => {
                                e.stopPropagation()
                                onDownload(stream)
                              }}
                              title="Download this stream"
                            >
                              <Download size={13} />
                            </button>
                          )}
                        </div>
                      </div>
                      {streamDisplaySettings.showDescription && stream.description && (
                        <div className={styles.streamDetails}>{stream.description}</div>
                      )}
                    </div>
                  )
                })}
          </div>
        </div>
      ) : !streamsLoading ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 bg-white/5 rounded-xl border border-white/5 text-center">
          <div className="bg-white/10 p-4 rounded-full mb-4">
            <Wifi size={32} className="text-gray-400 opacity-50" />
          </div>
          <h3 className="text-lg font-medium text-white mb-2">No streams found</h3>
          <p className="text-sm text-gray-400 max-w-md mb-5">
            No addons returned streams for this content. Install addons to start streaming.
          </p>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              onClick={onRefresh}
              className={`${styles.actionBtn} ${styles.btnSecondaryGlass}`}
              style={{ padding: '8px 20px' }}
            >
              Try Again
            </button>
            <button
              onClick={() =>
                navigate('/settings/explore-addons', {
                  state: {
                    from: window.location.pathname + window.location.search,
                    fromLabel: 'Back to Streaming',
                  },
                })
              }
              className={`${styles.actionBtn} ${styles.btnSecondaryGlass}`}
              style={{ padding: '8px 20px' }}
            >
              Get Addons
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
