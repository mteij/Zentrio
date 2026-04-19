export function SkeletonDetails() {
  return (
    <div className="flex gap-8 p-6 animate-pulse">
      {/* Poster */}
      <div className="hidden md:block flex-none w-[220px]">
        <div className="aspect-[2/3] rounded-xl bg-white/[0.06]" />
      </div>
      {/* Info */}
      <div className="flex-1 flex flex-col gap-4 pt-4">
        <div className="h-10 w-3/4 rounded-lg bg-white/[0.08]" />
        <div className="flex gap-3">
          {([80, 60, 70] as const).map((w, i) => (
            <div key={i} className="h-6 rounded bg-white/[0.05]" style={{ width: w }} />
          ))}
        </div>
        <div className="flex gap-4 mt-2">
          <div className="h-11 w-32 rounded-lg bg-white/15" />
          <div className="h-11 w-36 rounded-lg bg-white/[0.07]" />
        </div>
        <div className="h-20 w-full rounded-lg bg-white/[0.05] mt-4" />
        <div className="flex flex-col gap-2 mt-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 w-full rounded-lg bg-white/[0.03]" />
          ))}
        </div>
      </div>
    </div>
  )
}
