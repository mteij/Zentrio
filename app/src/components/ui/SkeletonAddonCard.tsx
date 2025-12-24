
export function SkeletonAddonCard() {
  return (
    <div className="relative flex flex-col p-5 bg-[#141414] border border-white/5 rounded-xl h-full animate-pulse">
      {/* Header */}
      <div className="flex gap-4 mb-4">
        {/* Logo */}
        <div className="w-12 h-12 rounded-lg bg-zinc-800 shrink-0" />
        
        {/* Info */}
        <div className="flex-1 space-y-2">
          <div className="h-5 w-3/4 bg-zinc-800 rounded" />
          <div className="flex gap-2">
            <div className="h-4 w-12 bg-zinc-800 rounded" />
            <div className="h-4 w-16 bg-zinc-800 rounded" />
          </div>
        </div>
      </div>
      
      {/* Description */}
      <div className="space-y-2 flex-1 mb-6">
        <div className="h-4 w-full bg-zinc-800 rounded" />
        <div className="h-4 w-5/6 bg-zinc-800 rounded" />
      </div>
      
      {/* Actions */}
      <div className="mt-auto">
        <div className="h-9 w-full bg-zinc-800 rounded-lg" />
      </div>
    </div>
  );
}
