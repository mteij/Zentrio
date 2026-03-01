// Stream Selector Component
// Extracted from Details.tsx
import { useEffect } from 'react'
import { Play, Check, ArrowLeft, Zap, HardDrive, Wifi } from 'lucide-react'
import { SkeletonStreamList } from '../../components'
import { StreamRefreshButton } from '../../components/features/StreamRefreshButton'
import { CompactStreamItem } from '../../components/features/CompactStreamItem'
import styles from '../../styles/Streaming.module.css'
import type { MetaDetail, Stream } from '../../services/addons/types'
import type { AddonLoadingState } from '../../hooks/useStreamLoader'

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
  const isExplicitlyUncached = uncachedIndicators.some(indicator =>
    combined.includes(indicator.toLowerCase()) || name.includes(indicator) || title.includes(indicator)
  )
  const bracketCachedPattern = /\[[a-z]{1,4}\+\]/i
  const isCached = !isExplicitlyUncached && (
    combined.includes('cached') ||
    combined.includes('⚡') ||
    combined.includes('✓') ||
    combined.includes('instant') ||
    combined.includes('your media') ||
    bracketCachedPattern.test(name) ||
    bracketCachedPattern.test(title)
  )
  
  // HDR/DV
  const hasHDR = combined.includes('hdr')
  const hasDV = combined.includes('dv') || combined.includes('dolby vision')
  
  return { resolution, size, isCached, hasHDR, hasDV }
}

interface StreamSelectorProps {
  meta: MetaDetail
  streams: any[]
  filteredStreams: { stream: Stream, addon: any }[]
  selectedEpisode: { season: number, number: number, title: string } | null
  addonStatuses: Map<string, AddonLoadingState>
  selectedAddon: string | null
  setSelectedAddon: (id: string | null) => void
  totalStreamCount: number
  streamsLoading: boolean
  cacheStatus: { cacheAgeMs?: number } | null
  streamDisplaySettings: {
    streamDisplayMode: 'classic' | 'compact-simple' | 'compact-advanced'
    showAddonName: boolean
    showDescription: boolean
  }
  onRefresh: () => void
  onPlay: (stream: Stream) => void
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
  totalStreamCount,
  streamsLoading,
  cacheStatus,
  streamDisplaySettings,
  onRefresh,
  onPlay,
  onBack
}: StreamSelectorProps) {

  // Cache the top stream in sessionStorage so the download button can pick up
  // the resolved URL without re-requesting streams.
  // Writes both a generic key and a per-episode key (for series).
  useEffect(() => {
    if (filteredStreams && filteredStreams.length > 0) {
      const top = filteredStreams[0]
      if (top.stream.url) {
        const payload = JSON.stringify({
          url: top.stream.url,
          addonId: top.addon?.id || '',
        })
        // Generic key (used by movie download + fallback for series)
        sessionStorage.setItem(`top_stream_${meta.id}`, payload)
        // Per-episode key (used by EpisodeList download option on the correct episode)
        if (selectedEpisode) {
          sessionStorage.setItem(
            `top_stream_${meta.id}_${selectedEpisode.season}_${selectedEpisode.number}`,
            payload
          )
        }
      }
    }
  }, [filteredStreams, meta.id, selectedEpisode])

  return (
    <div className={styles.streamsContainer}>
        {meta.type === 'series' && (
            <div className="flex items-center gap-4 mb-5">
                <button onClick={onBack} className={`${styles.actionBtn} ${styles.btnSecondaryGlass}`} style={{ padding: '8px 16px' }}>
                    <ArrowLeft size={16} />
                    Back
                </button>
                <h2 style={{ margin: 0, fontSize: '1.2rem' }}>
                    {selectedEpisode ? `S${selectedEpisode.season}:E${selectedEpisode.number} - ${selectedEpisode.title}` : 'Streams'}
                </h2>
            </div>
        )}

        {/* Unified Addon Status + Controls Bar */}
        {(addonStatuses.size > 0 || streams.length > 0) && (
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '16px',
                marginBottom: '20px',
                flexWrap: 'wrap'
            }}>
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
                    <span style={{ 
                        fontSize: '0.85rem', 
                        color: '#9ca3af',
                        fontWeight: 500
                    }}>
                        {totalStreamCount > 0 ? `${totalStreamCount} sources` : streamsLoading ? 'Loading...' : 'No sources'}
                    </span>

                    {/* Subtle separator */}
                    {addonStatuses.size > 0 && (
                        <span style={{ color: 'rgba(255,255,255,0.2)' }}>•</span>
                    )}

                    {/* Addon chips - subtle inline pills */}
                    {Array.from(addonStatuses.values()).map((addon) => (
                        <button
                            key={addon.id}
                            onClick={() => {
                                if (addon.status === 'done') {
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
                                cursor: addon.status === 'done' ? 'pointer' : 'default',
                                background: selectedAddon === addon.id
                                    ? 'rgba(139, 92, 246, 0.25)'
                                    : 'rgba(255, 255, 255, 0.06)',
                                fontSize: '0.75rem',
                                fontWeight: 500,
                                color: selectedAddon === addon.id
                                    ? '#c4b5fd'
                                    : addon.status === 'done' 
                                        ? 'rgba(255, 255, 255, 0.7)' 
                                        : addon.status === 'error' 
                                            ? '#f87171' 
                                            : 'rgba(255, 255, 255, 0.5)',
                                transition: 'all 0.15s ease',
                                outline: selectedAddon === addon.id ? '1px solid rgba(139, 92, 246, 0.5)' : 'none'
                            }}
                        >
                            {addon.status === 'loading' && (
                                <span style={{
                                    width: '10px',
                                    height: '10px',
                                    border: '1.5px solid currentColor',
                                    borderTopColor: 'transparent',
                                    borderRadius: '50%',
                                    animation: 'spin 1s linear infinite',
                                    display: 'inline-block'
                                }} />
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

        {streamsLoading && streams.length === 0 ? (
            <SkeletonStreamList />
        ) : filteredStreams && filteredStreams.length > 0 ? (
            /* Render based on displayMode setting */
            <div className="streams-list-wrapper">
                <div className={styles.streamList} style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: streamDisplaySettings.streamDisplayMode === 'classic' ? '12px' : '6px'
                }}>
                    {streamDisplaySettings.streamDisplayMode !== 'classic' ? (
                        /* Compact modes - tag-based display */
                        filteredStreams.map((item, idx) => (
                            <CompactStreamItem
                                key={idx}
                                item={item}
                                onClick={() => onPlay(item.stream)}
                                index={idx}
                                showAddonName={streamDisplaySettings.showAddonName}
                                mode={streamDisplaySettings.streamDisplayMode === 'compact-advanced' ? 'advanced' : 'simple'}
                            />
                        ))
                    ) : (
                        /* Classic mode - addon title + description */
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
                                                <span className={styles.streamBadge} style={{ background: 'rgba(255,255,255,0.1)', fontSize: '0.7rem' }}>
                                                    {addon.name}
                                                </span>
                                            )}
                                            {info.isCached && (
                                                <span className={`${styles.streamBadge} ${styles.badgeCached}`} title="Cached">
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
                                        </div>
                                    </div>
                                    {streamDisplaySettings.showDescription && stream.description && (
                                        <div className={styles.streamDetails}>{stream.description}</div>
                                    )}
                                </div>
                            )
                        })
                    )}
                </div>
            </div>
        ) : !streamsLoading ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 bg-white/5 rounded-xl border border-white/5 text-center">
                <div className="bg-white/10 p-4 rounded-full mb-4">
                    <Wifi size={32} className="text-gray-400 opacity-50" />
                </div>
                <h3 className="text-lg font-medium text-white mb-2">No streams found</h3>
                <p className="text-sm text-gray-400 max-w-md mb-5">
                    We couldn&apos;t find any streams for this content. Try adjusting your filters or checking your installed addons.
                </p>
                <button
                    onClick={onRefresh}
                    className={`${styles.actionBtn} ${styles.btnSecondaryGlass}`}
                    style={{ padding: '8px 20px' }}
                >
                    Try Again
                </button>
            </div>
        ) : null}
    </div>
  )
}
