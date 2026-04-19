export function SkeletonProfile() {
  return (
    <div className="flex flex-col items-center gap-3 p-4 animate-pulse">
      <div className="w-28 h-28 rounded-xl bg-white/[0.06]" />
      <div className="h-5 w-20 rounded bg-white/[0.05]" />
    </div>
  )
}
