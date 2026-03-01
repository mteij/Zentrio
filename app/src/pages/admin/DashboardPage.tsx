import { useQuery, useQueryClient } from '@tanstack/react-query'
import { RefreshCw, Users, ShieldCheck, Ban, LayoutGrid, MonitorPlay, Eye, Loader2 } from 'lucide-react'
import { adminApi } from '../../lib/adminApi'

function StatCard({ label, value, icon: Icon, color = 'text-zinc-300' }: {
  label: string
  value: number | string | undefined
  icon: React.ElementType
  color?: string
}) {
  return (
    <div className="bg-black/30 border border-white/10 rounded-xl p-4 flex items-center gap-4">
      <div className="p-2.5 rounded-lg bg-white/5">
        <Icon className={`w-5 h-5 ${color}`} />
      </div>
      <div>
        <p className="text-2xl font-bold text-white">
          {value ?? <span className="text-zinc-600">—</span>}
        </p>
        <p className="text-xs text-zinc-500 mt-0.5">{label}</p>
      </div>
    </div>
  )
}

function formatRelativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime()
  const secs = Math.floor(diff / 1000)
  if (secs < 60) return `${secs}s ago`
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export function DashboardPage() {
  const qc = useQueryClient()

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => adminApi.getStats(),
    refetchInterval: 30_000,
  })

  const { data: activity, isLoading: activityLoading } = useQuery({
    queryKey: ['admin-activity'],
    queryFn: () => adminApi.getLiveActivity(),
    refetchInterval: 30_000,
  })

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['admin-stats'] })
    qc.invalidateQueries({ queryKey: ['admin-activity'] })
  }

  const isLoading = statsLoading || activityLoading

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-white">Dashboard</h1>
        <button
          onClick={refresh}
          disabled={isLoading}
          className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <StatCard label="Total Users" value={stats?.users} icon={Users} />
        <StatCard label="Admins" value={stats?.admins} icon={ShieldCheck} color="text-amber-400" />
        <StatCard label="Banned" value={stats?.bannedUsers} icon={Ban} color="text-red-400" />
        <StatCard label="Profiles" value={stats?.profiles} icon={LayoutGrid} />
        <StatCard label="Active Streams" value={stats?.activeSessions} icon={MonitorPlay} color="text-emerald-400" />
        <StatCard label="Watched Items" value={stats?.watchedItems} icon={Eye} />
      </div>

      {/* Activity tables */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Active streaming sessions */}
        <div className="bg-black/30 border border-white/10 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
            <MonitorPlay className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-medium text-white">Active Streams</span>
            {activityLoading && <Loader2 className="w-3 h-3 animate-spin text-zinc-500 ml-auto" />}
          </div>
          <div className="divide-y divide-white/5 max-h-64 overflow-y-auto">
            {activity?.activeProxySessions.length === 0 && (
              <p className="px-4 py-6 text-sm text-zinc-600 text-center">No active streams</p>
            )}
            {activity?.activeProxySessions.map((s) => (
              <div key={s.id} className="px-4 py-2.5 flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-xs text-zinc-300 font-mono truncate">{s.user_id.slice(0, 8)}…</p>
                  <p className="text-xs text-zinc-600 truncate">{s.ip_address || 'unknown IP'}</p>
                </div>
                <span className="text-xs text-zinc-500 shrink-0 ml-3">
                  {formatRelativeTime(s.last_activity)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent watch events */}
        <div className="bg-black/30 border border-white/10 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
            <Eye className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-medium text-white">Recent Watch Events</span>
            {activityLoading && <Loader2 className="w-3 h-3 animate-spin text-zinc-500 ml-auto" />}
          </div>
          <div className="divide-y divide-white/5 max-h-64 overflow-y-auto">
            {activity?.recentWatchEvents.length === 0 && (
              <p className="px-4 py-6 text-sm text-zinc-600 text-center">No recent activity</p>
            )}
            {activity?.recentWatchEvents.map((e) => (
              <div key={e.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-zinc-300 truncate">{e.title || e.meta_id}</p>
                  <p className="text-xs text-zinc-600 capitalize">
                    {e.meta_type}{e.season != null && e.season > 0 ? ` S${e.season}E${e.episode}` : ''}
                  </p>
                </div>
                <span className="text-xs text-zinc-500 shrink-0">
                  {formatRelativeTime(e.updated_at)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
