interface SkeletonCardProps {
  className?: string
}

export function SkeletonCard({ className = '' }: SkeletonCardProps) {
  return (
    <div className={`flex-none w-[180px] ${className}`}>
      <div className="aspect-[2/3] rounded-xl bg-white/5 overflow-hidden animate-pulse" />
    </div>
  )
}
