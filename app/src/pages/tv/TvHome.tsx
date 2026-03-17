import { Compass, Library, Search, Settings, User } from 'lucide-react'
import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { LoadErrorState } from '../../components'
import { LoadingSpinner } from '../../components/ui/LoadingSpinner'
import { TvFocusable } from '../../components/tv/TvFocusable'
import { useAutoPlay } from '../../hooks/useAutoPlay'
import { useStreamingDashboard } from '../../hooks/useStreamingDashboard'
import { ZENTRIO_LOGO_192_URL } from '../../lib/brand-assets'
import { sanitizeImgSrc } from '../../lib/url'
import { useAuthStore } from '../../stores/authStore'
import type { MetaPreview } from '../../services/addons/types'
import type { WatchHistoryItem } from '../../services/database'
import styles from './TvHome.module.css'
import { createLogger } from '../../utils/client-logger'

const log = createLogger('TvHome')

function getMediaTitle(item: WatchHistoryItem | MetaPreview): string {
  if ('title' in item && item.title) return item.title
  if ('name' in item && item.name) return item.name
  return 'Untitled'
}

function getMediaPoster(item: WatchHistoryItem | MetaPreview): string {
  if ('poster' in item && item.poster) return item.poster
  return ''
}

function getMediaDescription(item: WatchHistoryItem): string | null {
  if (item.season !== undefined && item.episode !== undefined && item.season >= 0 && item.episode >= 0) {
    return `S${item.season} · E${item.episode}`
  }
  return null
}

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

export function TvHome() {
  const { profileId } = useParams<{ profileId: string }>()
  const navigate = useNavigate()
  const { startAutoPlay } = useAutoPlay()

  const { data, isLoading, isFetching, error, refetch } = useStreamingDashboard(profileId)

  useEffect(() => {
    const handleHistoryUpdate = () => { void refetch() }
    window.addEventListener('history-updated', handleHistoryUpdate)
    return () => window.removeEventListener('history-updated', handleHistoryUpdate)
  }, [refetch])

  useEffect(() => {
    if (error?.message === 'Unauthorized') {
      log.debug('401 Unauthorized, logging out locally')
      useAuthStore.getState().logout()
      navigate('/')
    }
  }, [error, navigate])

  if (error?.message === 'Unauthorized') return null

  if (error || !profileId) {
    return (
      <LoadErrorState
        message={error?.message || 'Failed to load TV home.'}
        onRetry={() => { void refetch() }}
        isRetrying={isFetching}
        onBack={() => navigate('/profiles')}
      />
    )
  }

  if (isLoading || !data) {
    return (
      <div className={styles.loadingRoot}>
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  const continueWatching = data.history.slice(0, 10)
  const trending = data.trending.slice(0, 10)
  const profileName = data.profile?.name || 'Profile'
  const firstContentAutoFocus = continueWatching.length === 0

  const navItems = [
    { label: 'Search', icon: Search, path: `/streaming/${profileId}/search` },
    { label: 'Explore', icon: Compass, path: `/streaming/${profileId}/explore` },
    { label: 'Library', icon: Library, path: `/streaming/${profileId}/library` },
    { label: 'Profiles', icon: User, path: '/profiles' },
    { label: 'Settings', icon: Settings, path: '/settings' },
  ]

  return (
    <div className={styles.root}>
      {/* Left navigation rail */}
      <nav className={styles.rail}>
        <div className={styles.railLogo}>
          <img src={ZENTRIO_LOGO_192_URL} alt="Zentrio" className={styles.railLogoImg} />
        </div>
        <div className={styles.railNav}>
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <TvFocusable
                key={item.label}
                className={styles.railItem}
                onActivate={() => navigate(item.path)}
                ariaLabel={item.label}
              >
                <Icon size={20} />
                <span>{item.label}</span>
              </TvFocusable>
            )
          })}
        </div>
      </nav>

      {/* Main content */}
      <main className={styles.main}>
        <header className={styles.header}>
          <p className={styles.greetingLabel}>{getGreeting()}</p>
          <h1 className={styles.greetingName}>{profileName}</h1>
        </header>

        {continueWatching.length > 0 && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Continue Watching</h2>
            <div className={styles.row}>
              {continueWatching.map((item, idx) => {
                const title = getMediaTitle(item)
                const progress = item.duration && item.position
                  ? Math.max(0, Math.min(100, Math.round((item.position / item.duration) * 100)))
                  : 0
                return (
                  <TvFocusable
                    key={`${item.meta_id}-${item.season ?? -1}-${item.episode ?? -1}`}
                    className={styles.card}
                    onActivate={() => {
                      startAutoPlay({
                        profileId,
                        meta: { id: item.meta_id, type: item.meta_type, name: title, poster: item.poster },
                        season: item.season,
                        episode: item.episode,
                        lastStream: (item as any).lastStream || item.last_stream,
                      })
                    }}
                    ariaLabel={`Continue watching ${title}`}
                    autoFocus={idx === 0}
                  >
                    <div
                      className={styles.poster}
                      style={{ backgroundImage: `url(${sanitizeImgSrc(getMediaPoster(item))})` }}
                    />
                    <div className={styles.cardInfo}>
                      <div className={styles.cardTitle}>{title}</div>
                      {getMediaDescription(item) && (
                        <div className={styles.cardMeta}>{getMediaDescription(item)}</div>
                      )}
                      <div className={styles.track}>
                        <div className={styles.fill} style={{ width: `${progress}%` }} />
                      </div>
                    </div>
                  </TvFocusable>
                )
              })}
            </div>
          </section>
        )}

        {trending.length > 0 && (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Trending Now</h2>
            <div className={styles.row}>
              {trending.map((item, idx) => (
                <TvFocusable
                  key={item.id}
                  className={styles.card}
                  onActivate={() => navigate(`/streaming/${profileId}/${item.type}/${item.id}`)}
                  ariaLabel={`Open ${item.name}`}
                  autoFocus={firstContentAutoFocus && idx === 0}
                >
                  <div
                    className={styles.poster}
                    style={{ backgroundImage: `url(${sanitizeImgSrc(getMediaPoster(item))})` }}
                  />
                  <div className={styles.cardInfo}>
                    <div className={styles.cardTitle}>{item.name}</div>
                    {item.releaseInfo && <div className={styles.cardMeta}>{item.releaseInfo}</div>}
                  </div>
                </TvFocusable>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  )
}

export default TvHome
