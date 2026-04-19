import { ArrowLeft, Bookmark, BookmarkCheck, CheckCircle, Circle, Download, Globe, HardDrive, Info, Play, RefreshCw, Users, Volume2, Zap } from 'lucide-react'
import { useState } from 'react'
import { LoadErrorState } from '../../components'
import { TvActionStrip, TvDialog, TvFocusItem, TvFocusScope, TvFocusZone, TvShelf } from '../../components/tv'
import { sanitizeImgSrc } from '../../lib/url'
import type { DetailsEpisodeItem, DetailsScreenModel, DetailsStreamItem } from './Details.model'
import styles from './Details.tv.module.css'

// ── Helpers ────────────────────────────────────────────────

function formatSize(bytes?: number): string | null {
  if (!bytes) return null
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GB`
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)}MB`
  return null
}

function formatSourceType(type?: string): string | null {
  if (!type || type === 'unknown') return null
  const map: Record<string, string> = { bluray: 'BluRay', web: 'WEB', hdtv: 'HDTV', telesync: 'TS', cam: 'CAM' }
  return map[type] || type.toUpperCase()
}

const languageToCountry: Record<string, string> = {
  English: 'gb', Dutch: 'nl', German: 'de', French: 'fr', Spanish: 'es',
  Italian: 'it', Portuguese: 'pt', Russian: 'ru', Japanese: 'jp', Korean: 'kr',
  Chinese: 'cn', Arabic: 'sa', Hindi: 'in', Turkish: 'tr', Polish: 'pl',
  Swedish: 'se', Norwegian: 'no', Danish: 'dk', Finnish: 'fi', Czech: 'cz',
}

function buildBadges(model: DetailsScreenModel): string[] {
  const meta = model.data?.meta
  if (!meta) return []
  const badges: string[] = []
  if (meta.released) badges.push(String(meta.released).split('-')[0])
  if (meta.runtime) badges.push(meta.runtime)
  if (meta.imdbRating) badges.push(`IMDb ${meta.imdbRating}`)
  if (meta.type === 'series' && model.seasons.length > 0)
    badges.push(`${model.seasons.length} Season${model.seasons.length === 1 ? '' : 's'}`)
  return badges
}

// ── Sub-components ─────────────────────────────────────────

function EpisodeItem({
  ep,
  isSelected,
  onSelect,
  onMarkWatched,
}: {
  ep: DetailsEpisodeItem
  isSelected: boolean
  onSelect: () => void
  onMarkWatched: () => void
}) {
  return (
    <div className={`${styles.episodeRow} ${isSelected ? styles.episodeRowSelected : ''}`}>
      <TvFocusItem
        id={`details-ep-${ep.id}`}
        className={`${styles.episodeItem} ${isSelected ? styles.episodeItemSelected : ''}`}
        onActivate={onSelect}
      >
        {ep.thumbnail && (
          <div
            className={styles.episodeThumb}
            style={{ backgroundImage: `url(${sanitizeImgSrc(ep.thumbnail)})` }}
          />
        )}
        <div className={styles.episodeText}>
          <div className={styles.episodeHeader}>
            <span className={styles.episodeNum}>E{ep.episode}</span>
            <span className={styles.episodeName}>{ep.title}</span>
          </div>
          {ep.isWatched
            ? <span className={styles.episodeWatched}>Watched</span>
            : ep.watchedPercent
              ? (
                <div className={styles.progress}>
                  <div className={styles.progressFill} style={{ width: `${ep.watchedPercent}%` }} />
                </div>
              )
              : null}
        </div>
        <Play size={13} className={styles.episodePlayIcon} />
      </TvFocusItem>

      <TvFocusItem
        id={`details-ep-watched-${ep.id}`}
        className={`${styles.episodeAction} ${ep.isWatched ? styles.episodeActionActive : ''}`}
        onActivate={onMarkWatched}
        title={ep.isWatched ? 'Mark unwatched' : 'Mark watched'}
      >
        {ep.isWatched ? <CheckCircle size={15} /> : <Circle size={15} />}
      </TvFocusItem>
    </div>
  )
}

function StreamItem({
  stream,
  index,
  canDownload,
  displayMode,
  showAddonName,
  onPlay,
  onDownload,
}: {
  stream: DetailsStreamItem
  index: number
  canDownload: boolean
  displayMode: 'compact-simple' | 'compact-advanced' | 'classic'
  showAddonName: boolean
  onPlay: () => void
  onDownload: () => void
}) {
  const parsed = stream.parsed
  const isCached = parsed?.isCached ?? false
  const isAdvanced = displayMode === 'compact-advanced'
  const isClassic = displayMode === 'classic'

  if (isClassic) {
    // Classic mode: title + fallback badge chips
    const tags = stream.subtitle ? stream.subtitle.split(' · ') : []
    return (
      <div className={styles.streamRow}>
        <TvFocusItem
          id={`details-stream-${index}`}
          index={index * 2}
          className={styles.streamItem}
          onActivate={onPlay}
        >
          {tags.map((tag) => (
            <span
              key={tag}
              className={`${styles.streamTag} ${
                tag === 'Cached' ? styles.streamTagCached
                  : tag === '4K' ? styles.streamTag4k
                    : tag === '1080P' ? styles.streamTag1080
                      : tag === '720P' ? styles.streamTag720
                        : styles.streamTagDefault
              }`}
            >
              {tag === 'Cached' && <Zap size={11} />}
              {tag}
            </span>
          ))}
          <span className={styles.streamName}>{stream.title}</span>
          <Play size={13} className={styles.streamPlayIcon} />
        </TvFocusItem>
        {canDownload && (
          <TvFocusItem
            id={`details-stream-dl-${index}`}
            index={index * 2 + 1}
            className={styles.streamActionBtn}
            onActivate={onDownload}
          >
            <Download size={14} />
          </TvFocusItem>
        )}
      </div>
    )
  }

  // Compact simple / advanced
  const resolution = parsed?.resolution?.toUpperCase() || ''
  const sourceType = formatSourceType(parsed?.sourceType)
  const visualTags = parsed?.visualTags || []
  const languages = parsed?.languages || []
  const size = formatSize(parsed?.size)
  const audioTags = parsed?.audioTags || []
  const audioChannels = parsed?.audioChannels || []
  const encode = parsed?.encode || []
  const seeders = parsed?.seeders
  const primaryAudio = audioTags[0]?.toUpperCase()
  const primaryChannel = audioChannels[0]

  const resTagClass = resolution === '4K' ? styles.streamTag4k
    : resolution === '1080P' ? styles.streamTag1080
      : resolution === '720P' ? styles.streamTag720
        : resolution === '480P' ? styles.streamTag480
          : styles.streamTagDefault

  const seederColor = seeders !== undefined
    ? (seeders > 50 ? { bg: 'rgba(34,197,94,0.15)', color: '#86efac' }
      : seeders > 10 ? { bg: 'rgba(250,204,21,0.15)', color: '#fde047' }
        : { bg: 'rgba(239,68,68,0.15)', color: '#fca5a5' })
    : null

  return (
    <div className={styles.streamRow}>
      <TvFocusItem
        id={`details-stream-${index}`}
        index={index * 2}
        className={`${styles.streamItem} ${isCached ? styles.streamItemCached : ''}`}
        onActivate={onPlay}
      >
        {isCached && <Zap size={13} className={styles.streamCachedIcon} />}

        {resolution && <span className={`${styles.streamTag} ${resTagClass}`}>{resolution}</span>}

        {sourceType && <span className={`${styles.streamTag} ${styles.streamTagDefault}`}>{sourceType}</span>}

        {visualTags.map((tag) => (
          <span
            key={tag}
            className={`${styles.streamTag} ${tag === 'dv' ? styles.streamTagDv : styles.streamTagHdr}`}
          >
            {tag.toUpperCase()}
          </span>
        ))}

        {isAdvanced && (primaryAudio || primaryChannel) && (
          <span className={`${styles.streamTag} ${styles.streamTagAudio}`}>
            <Volume2 size={10} />
            {primaryAudio}{primaryChannel ? ` ${primaryChannel}` : ''}
          </span>
        )}

        {isAdvanced && encode.length > 0 && (
          <span className={`${styles.streamTag} ${styles.streamTagCodec}`}>{encode[0].toUpperCase()}</span>
        )}

        {size && (
          <span className={`${styles.streamTag} ${styles.streamTagSize}`}>
            <HardDrive size={10} />
            {size}
          </span>
        )}

        {isAdvanced && seederColor && seeders! > 0 && (
          <span
            className={styles.streamTag}
            style={{ background: seederColor.bg, color: seederColor.color, border: 'none' }}
          >
            <Users size={10} />
            {seeders}
          </span>
        )}

        {languages.length > 0 && (
          <span className={`${styles.streamTag} ${styles.streamTagLang}`}>
            {languages.slice(0, 3).map((lang) => {
              const cc = languageToCountry[lang]
              return cc
                ? (
                    <img
                      key={lang}
                      src={`https://flagcdn.com/w40/${cc}.png`}
                      width={14}
                      height={10}
                      alt={lang}
                      title={lang}
                      style={{ borderRadius: '2px', objectFit: 'cover' }}
                    />
                  )
                : <Globe key={lang} size={11} style={{ opacity: 0.5 }} />
            })}
          </span>
        )}

        {showAddonName && stream.addonName && (
          <span className={styles.streamAddonName}>{stream.addonName}</span>
        )}

        <Play size={13} className={styles.streamPlayIcon} />
      </TvFocusItem>

      {canDownload && (
        <TvFocusItem
          id={`details-stream-dl-${index}`}
          index={index * 2 + 1}
          className={styles.streamActionBtn}
          onActivate={onDownload}
        >
          <Download size={14} />
        </TvFocusItem>
      )}
    </div>
  )
}

// ── Main view ──────────────────────────────────────────────

export function StreamingDetailsTvView({ model }: { model: DetailsScreenModel }) {
  const [showInfo, setShowInfo] = useState(false)

  if (model.status === 'loading') {
    return (
      <div className="h-screen bg-black flex overflow-hidden animate-pulse">
        {/* Left panel: poster + meta */}
        <div className="flex-none w-72 flex flex-col gap-5 p-10">
          <div className="aspect-[2/3] rounded-xl bg-white/[0.06]" />
          <div className="flex flex-col gap-3">
            <div className="h-4 w-20 rounded bg-white/[0.05]" />
            <div className="h-8 w-48 rounded-lg bg-white/[0.08]" />
            <div className="flex gap-2 flex-wrap">
              {[60, 50, 70].map((w, i) => (
                <div key={i} className="h-5 rounded bg-white/[0.05]" style={{ width: w }} />
              ))}
            </div>
            <div className="h-24 w-full rounded-lg bg-white/[0.04] mt-2" />
          </div>
        </div>
        {/* Right panel: actions + stream list */}
        <div className="flex-1 flex flex-col gap-6 p-10 pt-12">
          <div className="flex gap-3">
            <div className="h-12 w-32 rounded-xl bg-white/15" />
            <div className="h-12 w-36 rounded-xl bg-white/[0.07]" />
            <div className="h-12 w-36 rounded-xl bg-white/[0.07]" />
            <div className="h-12 w-12 rounded-xl bg-white/[0.05]" />
          </div>
          <div className="flex flex-col gap-3 mt-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-14 rounded-xl bg-white/[0.05] border border-white/[0.02]" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (model.status === 'error' || !model.data) {
    return (
      <div className={styles.fullscreen}>
        <LoadErrorState
          message={model.errorMessage || 'Failed to load details.'}
          onRetry={() => void model.actions.retry()}
          onBack={model.navigation.goBack}
        />
      </div>
    )
  }

  const meta = model.data.meta
  const badges = buildBadges(model)
  const backdropUrl = sanitizeImgSrc(meta.background || meta.poster || '')
  const posterUrl = sanitizeImgSrc(meta.poster || meta.background || '')
  const isSeries = meta.type === 'series'

  const inSourcesView = isSeries ? model.view === 'sources' : true
  const hasSeasons = model.seasons.length > 0
  const hasEpisodes = model.episodes.length > 0
  const hasStreams = model.streams.length > 0
  const hasInfoContent = model.cast.length > 0 || model.director.length > 0

  const isCurrentWatched = isSeries
    ? (model.selectedEpisode
      ? model.episodes.find((e) => e.id === model.selectedEpisode?.id)?.isWatched
      : false)
    : model.data.watchProgress?.isWatched

  const listZone = inSourcesView
    ? (hasStreams || model.isLoadingStreams ? 'details-list' : undefined)
    : (hasSeasons ? 'details-seasons' : hasEpisodes ? 'details-list' : undefined)

  const { streamDisplayMode, showAddonName } = model.streamDisplaySettings

  return (
    <TvFocusScope
      className={styles.fullscreen}
      initialZoneId="details-actions"
      onBack={model.navigation.goBack}
    >
      {backdropUrl && (
        <div className={styles.backdrop} style={{ backgroundImage: `url(${backdropUrl})` }} />
      )}

      <div className={styles.layout}>

        {/* ── Left: poster + metadata ── */}
        <aside className={styles.infoPanel}>
          <div className={styles.poster} style={{ backgroundImage: `url(${posterUrl})` }} />
          <div className={styles.infoMeta}>
            <p className={styles.contentType}>{isSeries ? 'Series' : 'Movie'}</p>
            <h1 className={styles.title}>{meta.name}</h1>
            {badges.length > 0 && (
              <div className={styles.badges}>
                {badges.map((b) => <span key={b} className={styles.badge}>{b}</span>)}
              </div>
            )}
            {model.genres.length > 0 && (
              <div className={styles.genres}>
                {model.genres.map((g) => <span key={g} className={styles.genre}>{g}</span>)}
              </div>
            )}
            {meta.description && <p className={styles.desc}>{meta.description}</p>}
          </div>
        </aside>

        {/* ── Right: actions + list ── */}
        <div className={styles.panel}>

          {/* Action row */}
          <TvActionStrip zoneId="details-actions" nextDown={listZone}>
            <TvFocusItem
              id="details-play"
              className={`${styles.btn} ${styles.btnPrimary}`}
              onActivate={model.actions.playPrimary}
            >
              <Play size={17} />
              <span>
                {model.selectedEpisode
                  ? `Play S${model.selectedEpisode.season}·E${model.selectedEpisode.episode}`
                  : 'Play'}
              </span>
            </TvFocusItem>

            <TvFocusItem
              id="details-list"
              className={`${styles.btn} ${model.inList ? styles.btnActive : styles.btnSecondary}`}
              onActivate={() => void model.actions.toggleList()}
            >
              {model.inList ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
              <span>{model.inList ? 'In Watchlist' : 'Watchlist'}</span>
            </TvFocusItem>

            <TvFocusItem
              id="details-watched"
              className={`${styles.btn} ${isCurrentWatched ? styles.btnActive : styles.btnSecondary}`}
              onActivate={() => {
                if (isSeries && model.selectedEpisode) {
                  void model.actions.toggleWatched(model.selectedEpisode.season, model.selectedEpisode.episode)
                } else if (!isSeries) {
                  void model.actions.toggleWatched()
                }
              }}
            >
              {isCurrentWatched ? <CheckCircle size={15} /> : <Circle size={15} />}
              <span>{isCurrentWatched ? 'Watched' : 'Mark Watched'}</span>
            </TvFocusItem>

            {hasInfoContent && (
              <TvFocusItem
                id="details-info"
                className={`${styles.btn} ${styles.btnIcon}`}
                onActivate={() => setShowInfo(true)}
              >
                <Info size={15} />
              </TvFocusItem>
            )}

            {isSeries && inSourcesView && (
              <TvFocusItem
                id="details-back"
                className={`${styles.btn} ${styles.btnIcon}`}
                onActivate={() => model.actions.setView('episodes')}
              >
                <ArrowLeft size={15} />
              </TvFocusItem>
            )}

            {isSeries && !inSourcesView && model.selectedSeason != null && (
              <TvFocusItem
                id="details-season-watched"
                className={`${styles.btn} ${styles.btnIcon}`}
                onActivate={() => void model.actions.toggleSeasonWatched(model.selectedSeason!, true)}
                title="Mark season watched"
              >
                <CheckCircle size={15} />
              </TvFocusItem>
            )}

            <TvFocusItem
              id="details-refresh"
              className={`${styles.btn} ${styles.btnIcon}`}
              onActivate={model.actions.refreshStreams}
            >
              <RefreshCw size={15} />
            </TvFocusItem>
          </TvActionStrip>

          {/* Season chips */}
          {!inSourcesView && hasSeasons && (
            <TvShelf
              zoneId="details-seasons"
              nextUp="details-actions"
              nextDown={hasEpisodes ? 'details-list' : undefined}
            >
              {model.seasons.map((s, i) => (
                <TvFocusItem
                  key={s}
                  id={`details-season-${s}`}
                  index={i}
                  className={`${styles.seasonChip} ${model.selectedSeason === s ? styles.seasonChipActive : ''}`}
                  onActivate={() => model.actions.selectSeason(s)}
                >
                  Season {s}
                </TvFocusItem>
              ))}
            </TvShelf>
          )}

          {/* Scrollable list */}
          <div className={styles.listArea}>

            {/* Episode list */}
            {!inSourcesView && hasEpisodes && (
              <TvFocusZone
                id="details-list"
                orientation="vertical"
                nextUp={hasSeasons ? 'details-seasons' : 'details-actions'}
              >
                {model.episodes.map((ep) => (
                  <EpisodeItem
                    key={ep.id}
                    ep={ep}
                    isSelected={model.selectedEpisode?.id === ep.id}
                    onSelect={() => model.actions.selectEpisode(ep)}
                    onMarkWatched={() => void model.actions.toggleWatched(ep.season, ep.episode)}
                  />
                ))}
              </TvFocusZone>
            )}

            {/* Stream list */}
            {inSourcesView && (
              model.isLoadingStreams && !hasStreams
                ? (
                    <div className={styles.streamsLoading}>
                      <div className="w-5 h-5 rounded-full border-2 border-white/10 border-t-white/70 animate-spin shrink-0" />
                      <span>Searching sources…</span>
                    </div>
                  )
                : hasStreams
                  ? (
                      <TvFocusZone
                        id="details-list"
                        orientation="vertical"
                        nextUp="details-actions"
                      >
                        {model.streams.map((stream, i) => (
                          <StreamItem
                            key={stream.id}
                            stream={stream}
                            index={i}
                            canDownload={model.canDownload}
                            displayMode={streamDisplayMode}
                            showAddonName={showAddonName}
                            onPlay={() => model.navigation.playStream(stream.url)}
                            onDownload={() => void model.actions.downloadStream(i)}
                          />
                        ))}
                      </TvFocusZone>
                    )
                  : !model.isLoadingStreams
                    ? <div className={styles.emptyStreams}>No sources found — press refresh to try again.</div>
                    : null
            )}
          </div>
        </div>
      </div>

      {/* Info dialog */}
      {showInfo && (
        <TvDialog
          title="Cast & Crew"
          open={showInfo}
          onBack={() => setShowInfo(false)}
          initialZoneId="info-close"
        >
          <TvFocusZone id="info-close" orientation="horizontal">
            <TvFocusItem
              id="info-close-btn"
              className={styles.infoCloseBtn}
              onActivate={() => setShowInfo(false)}
            >
              Close
            </TvFocusItem>
          </TvFocusZone>
          {model.director.length > 0 && (
            <div className={styles.infoSection}>
              <p className={styles.infoLabel}>Director</p>
              <p className={styles.infoValue}>{model.director.join(', ')}</p>
            </div>
          )}
          {model.cast.length > 0 && (
            <div className={styles.infoSection}>
              <p className={styles.infoLabel}>Cast</p>
              <div className={styles.castGrid}>
                {model.cast.map((member) => (
                  <div key={member.name} className={styles.castMember}>
                    {member.photo
                      ? <img src={sanitizeImgSrc(member.photo)} alt={member.name} className={styles.castPhoto} />
                      : <div className={styles.castPhotoPlaceholder} />}
                    <p className={styles.castName}>{member.name}</p>
                    {member.character && <p className={styles.castCharacter}>{member.character}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </TvDialog>
      )}
    </TvFocusScope>
  )
}

export default StreamingDetailsTvView
