/**
 * A minimal skeleton for the player page — dark screen with a spinning buffering indicator.
 */
export function SkeletonPlayer() {
  return (
    <div className="absolute inset-0 bg-black flex items-center justify-center">
      <div className="w-12 h-12 rounded-full border-2 border-white/10 border-t-white/80 animate-spin" />
    </div>
  )
}
