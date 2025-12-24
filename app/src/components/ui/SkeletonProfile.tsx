
export function SkeletonProfile() {
  return (
    <div className="flex flex-col items-center gap-4 p-4 animate-pulse">
      <div className="w-32 h-32 rounded-lg bg-zinc-800/50 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-zinc-800 to-transparent -translate-x-full animate-[shimmer_1.5s_infinite]" />
      </div>
      <div className="h-6 w-24 bg-zinc-800/50 rounded" />
    </div>
  );
}
