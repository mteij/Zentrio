export function SkeletonStreamList() {
  return (
    <div className="flex flex-col gap-3 mt-5 animate-pulse">
      <div className="h-10 w-60 rounded-xl bg-white/[0.05]" />
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="h-20 rounded-xl bg-white/[0.05] border border-white/[0.02]" />
      ))}
    </div>
  )
}
