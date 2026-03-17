import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Star } from 'lucide-react'
import { sanitizeImgSrc } from '../../lib/url'
import { TvFocusItem } from './TvFocusContext'
import { TvSection, TvShelf } from './TvPageScaffold'
import styles from './TvMediaShelf.module.css'

export interface TvShelfItem {
  id: string
  type: string
  name: string
  poster?: string | null
  releaseInfo?: string | null
  imdbRating?: string | null
  ageRating?: string | null
  progressPercent?: number
  title?: string
  meta?: string | null
  isWatched?: boolean
  certification?: string | null
  rating?: string | null
  contentRating?: string | null
  info?: {
    certification?: unknown
    rating?: unknown
  }
}

interface TvMediaShelfProps<TItem extends TvShelfItem> {
  title: string
  zoneId: string
  queryKey?: readonly unknown[]
  queryFn?: () => Promise<TItem[]>
  items?: TItem[]
  onActivate: (item: TItem) => void
  nextUp?: string
  nextDown?: string
  nextLeft?: string
  nextRight?: string
  initialItemId?: string
  priority?: 'eager' | 'lazy'
  hideWhenEmpty?: boolean
  showImdbRatings?: boolean
  showAgeRatings?: boolean
}

function getAgeRating(item: TvShelfItem): string | null {
  const direct = item.ageRating || item.certification || item.rating || item.contentRating
  if (direct) return direct

  const infoCertification = item.info?.certification
  if (typeof infoCertification === 'string') return infoCertification

  const infoRating = item.info?.rating
  if (typeof infoRating === 'string') return infoRating

  return null
}

function getImdbRating(item: TvShelfItem): number | null {
  if (!item.imdbRating) return null

  const parsedRating = Number.parseFloat(item.imdbRating)
  if (!Number.isFinite(parsedRating) || parsedRating <= 0) return null

  return parsedRating
}

function TvShelfCard<TItem extends TvShelfItem>({
  item,
  id,
  index,
  onActivate,
  showImdbRatings,
  showAgeRatings,
}: {
  item: TItem
  id: string
  index: number
  onActivate: (item: TItem) => void
  showImdbRatings: boolean
  showAgeRatings: boolean
}) {
  const title = item.title || item.name
  const meta = item.meta
  const ageRating = showAgeRatings ? getAgeRating(item) : null
  const imdbRating = showImdbRatings ? getImdbRating(item) : null

  return (
    <TvFocusItem id={id} index={index} className={styles.card} onActivate={() => onActivate(item)} aria-label={title}>
      <div className={styles.posterShell}>
        {item.poster ? (
          <img src={sanitizeImgSrc(item.poster)} alt={title} className={styles.poster} loading="lazy" />
        ) : (
          <div className={styles.poster} aria-hidden="true" />
        )}
        <div className={styles.posterBadges}>
          {item.isWatched ? (
            <span className={`${styles.posterBadge} ${styles.watchedBadge}`} aria-label="Watched">
              <Check size={13} strokeWidth={3} />
            </span>
          ) : null}
          {ageRating ? <span className={styles.posterBadge}>{ageRating}</span> : null}
        </div>
        {imdbRating ? (
          <span className={`${styles.posterBadge} ${styles.ratingBadge}`} aria-label={`IMDb ${imdbRating.toFixed(1)}`}>
            <Star size={13} fill="currentColor" />
            <span>{imdbRating.toFixed(1)}</span>
          </span>
        ) : null}
      </div>
      <div className={styles.body}>
        <p className={styles.cardTitle}>{title}</p>
        {meta ? <p className={styles.cardMeta}>{meta}</p> : null}
        {typeof item.progressPercent === 'number' ? (
          <div className={styles.progressTrack}>
            <div className={styles.progressFill} style={{ width: `${Math.max(0, Math.min(100, item.progressPercent))}%` }} />
          </div>
        ) : null}
      </div>
    </TvFocusItem>
  )
}

export function TvMediaShelf<TItem extends TvShelfItem>({
  title,
  zoneId,
  queryKey,
  queryFn,
  items,
  onActivate,
  nextUp,
  nextDown,
  nextLeft,
  nextRight,
  initialItemId,
  priority = 'lazy',
  hideWhenEmpty = true,
  showImdbRatings = true,
  showAgeRatings = true,
}: TvMediaShelfProps<TItem>) {
  const rowRef = useRef<HTMLDivElement | null>(null)
  const isObserverSupported = typeof IntersectionObserver !== 'undefined'
  const [isNearViewport, setIsNearViewport] = useState(priority === 'eager' || !queryFn || !isObserverSupported)

  useEffect(() => {
    if (!queryFn || priority === 'eager' || !isObserverSupported) return

    const element = rowRef.current
    if (!element) return

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries
        if (entry?.isIntersecting) {
          setIsNearViewport(true)
          observer.disconnect()
        }
      },
      { rootMargin: '250px 0px', threshold: 0.01 },
    )

    observer.observe(element)
    return () => observer.disconnect()
  }, [isObserverSupported, priority, queryFn])

  const { data = [], isLoading, error } = useQuery({
    queryKey: queryKey || ['tv-media-shelf', title],
    queryFn: queryFn || (async () => items || []),
    enabled: Boolean(queryFn ? isNearViewport : true),
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
    retry: 1,
  })

  const resolvedItems = useMemo(() => (queryFn ? data : items || []), [data, items, queryFn])
  const isPendingActivation = Boolean(queryFn) && !isNearViewport

  if (error) return null
  if (hideWhenEmpty && !isLoading && !isPendingActivation && resolvedItems.length === 0) return null

  return (
    <div ref={rowRef} className={styles.section}>
      <TvSection title={title}>
        {isLoading || isPendingActivation ? (
          <div className={styles.skeletonShelf}>
            {Array.from({ length: 7 }).map((_, index) => (
              <div key={`${zoneId}-skeleton-${index}`} className={styles.skeletonCard} />
            ))}
          </div>
        ) : (
          <TvShelf
            zoneId={zoneId}
            nextUp={nextUp}
            nextDown={nextDown}
            nextLeft={nextLeft}
            nextRight={nextRight}
            initialItemId={initialItemId}
          >
            {resolvedItems.map((item, index) => (
              <TvShelfCard
                key={`${zoneId}-${item.type}-${item.id}-${index}`}
                id={`${zoneId}-${item.id}-${index}`}
                index={index}
                item={item}
                onActivate={onActivate}
                showImdbRatings={showImdbRatings}
                showAgeRatings={showAgeRatings}
              />
            ))}
          </TvShelf>
        )}
      </TvSection>
    </div>
  )
}

export default TvMediaShelf
