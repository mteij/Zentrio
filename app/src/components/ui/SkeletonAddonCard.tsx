export function SkeletonAddonCard() {
  return (
    <div className="flex flex-col p-5 bg-[#141414] border border-white/5 rounded-xl h-full animate-pulse">
      <div className="flex gap-4 mb-4">
        <div className="w-12 h-12 rounded-lg bg-white/[0.06] shrink-0" />
        <div className="flex-1 flex flex-col gap-2">
          <div className="h-5 w-3/4 rounded bg-white/[0.06]" />
          <div className="flex gap-2">
            <div className="h-4 w-14 rounded-full bg-white/[0.04]" />
            <div className="h-4 w-16 rounded-full bg-white/[0.04]" />
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-2 flex-1 mb-5">
        <div className="h-4 w-full rounded bg-white/[0.04]" />
        <div className="h-4 w-5/6 rounded bg-white/[0.04]" />
        <div className="h-4 w-4/6 rounded bg-white/[0.04]" />
      </div>
      <div className="h-9 w-full rounded-lg bg-white/[0.06]" />
    </div>
  )
}
