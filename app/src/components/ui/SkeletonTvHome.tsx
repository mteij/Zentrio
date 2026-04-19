export function SkeletonTvHome() {
  return (
    <div className="h-screen bg-black flex flex-col overflow-hidden animate-pulse">
      {/* Hero */}
      <div className="relative flex-none h-[55vh]">
        <div className="absolute inset-0 bg-white/[0.03]" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/10 to-transparent" />
        <div className="absolute bottom-12 left-20 flex flex-col gap-4">
          <div className="h-10 w-96 rounded-lg bg-white/[0.08]" />
          <div className="h-16 w-[600px] rounded-lg bg-white/[0.05]" />
          <div className="flex gap-4 mt-2">
            <div className="h-14 w-44 rounded-xl bg-white/15" />
            <div className="h-14 w-40 rounded-xl bg-white/[0.07]" />
          </div>
        </div>
      </div>
      {/* Shelves */}
      <div className="flex flex-col gap-8 px-20 pt-8">
        {[1, 2, 3].map((shelf) => (
          <div key={shelf} className="flex flex-col gap-4">
            <div className="h-6 w-48 rounded bg-white/[0.06]" />
            <div className="flex gap-4 overflow-hidden">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex-none w-44 aspect-[2/3] rounded-xl bg-white/[0.05]" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
