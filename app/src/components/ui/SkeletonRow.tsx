import { SkeletonCard } from './SkeletonCard'

interface SkeletonRowProps {
  cardCount?: number
  showTitle?: boolean
}

export function SkeletonRow({ cardCount = 7, showTitle = true }: SkeletonRowProps) {
  return (
    <div className="flex flex-col gap-3 mb-6">
      {showTitle && <div className="h-6 w-40 rounded bg-white/5 animate-pulse mx-6" />}
      <div className="flex gap-3 px-6 overflow-hidden">
        {Array.from({ length: cardCount }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  )
}
