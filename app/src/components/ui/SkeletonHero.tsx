export function SkeletonHero() {
  return (
    <div
      className="relative h-[520px] md:h-[600px] overflow-hidden animate-pulse"
      style={{
        marginLeft: 'var(--standard-shell-side-nav-width, 0px)',
        width: 'calc(100% - var(--standard-shell-side-nav-width, 0px))',
      }}
    >
      <div className="absolute inset-0 bg-white/[0.03]" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
      <div className="absolute bottom-10 left-8 md:left-16 flex flex-col gap-3">
        <div className="h-4 w-28 rounded-full bg-white/10" />
        <div className="h-10 w-64 md:w-80 rounded-lg bg-white/[0.08]" />
        <div className="h-16 w-80 md:w-[480px] rounded-lg bg-white/[0.05]" />
        <div className="flex gap-3 mt-2">
          <div className="h-11 w-32 rounded-lg bg-white/15" />
          <div className="h-11 w-28 rounded-lg bg-white/[0.07]" />
        </div>
      </div>
    </div>
  )
}
