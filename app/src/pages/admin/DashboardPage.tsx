import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { RefreshCw, Users, ShieldCheck, Ban, LayoutGrid, MonitorPlay, Eye, Loader2 } from 'lucide-react'
import { adminApi } from '../../lib/adminApi'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts'

function StatCard({ label, value, icon: Icon, color = 'text-zinc-300', loading = false }: {
  label: string
  value: number | string | undefined
  icon: React.ElementType
  color?: string
  loading?: boolean
}) {
  return (
    <div className="bg-black/30 border border-white/10 rounded-xl p-4 flex items-center gap-4">
      <div className="p-2.5 rounded-lg bg-white/5">
        <Icon className={`w-5 h-5 ${color}`} />
      </div>
      <div>
        {loading ? (
          <div className="h-8 w-16 bg-white/10 animate-pulse rounded my-0.5" />
        ) : (
          <p className="text-2xl font-bold text-white">
            {value ?? <span className="text-zinc-600">—</span>}
          </p>
        )}
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
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d' | 'all'>('30d')

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

  const { data: charts, isLoading: chartsLoading } = useQuery({
    queryKey: ['admin-charts', timeRange],
    queryFn: () => adminApi.getDashboardCharts(timeRange),
    refetchInterval: 60_000,
  })

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['admin-stats'] })
    qc.invalidateQueries({ queryKey: ['admin-activity'] })
    qc.invalidateQueries({ queryKey: ['admin-charts'] })
  }

  const isLoading = statsLoading || activityLoading || chartsLoading

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-white">Dashboard</h1>
        <div className="flex items-center gap-4">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as any)}
            className="bg-black/30 border border-white/10 text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-400"
          >
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="all">All Time</option>
          </select>
          <button
            onClick={refresh}
            disabled={isLoading}
            className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <StatCard label="Total Users" value={stats?.users} icon={Users} loading={statsLoading} />
        <StatCard label="Admins" value={stats?.admins} icon={ShieldCheck} color="text-amber-400" loading={statsLoading} />
        <StatCard label="Banned" value={stats?.bannedUsers} icon={Ban} color="text-red-400" loading={statsLoading} />
        <StatCard label="Profiles" value={stats?.profiles} icon={LayoutGrid} loading={statsLoading} />
        <StatCard label="Active Streams" value={stats?.activeSessions} icon={MonitorPlay} color="text-emerald-400" loading={statsLoading} />
        <StatCard label="Watched Items" value={stats?.watchedItems} icon={Eye} loading={statsLoading} />
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* User Growth Chart */}
        <div className="bg-black/30 border border-white/10 rounded-xl p-4">
          <h2 className="text-sm font-medium text-white mb-4">New Users</h2>
          <div className="h-64 w-full">
            {chartsLoading ? (
              <div className="w-full h-full flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-zinc-600" />
              </div>
            ) : charts?.chartData?.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={charts.chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                  <XAxis dataKey="label" stroke="#ffffff40" fontSize={10} />
                  <YAxis stroke="#ffffff40" fontSize={10} allowDecimals={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#18181b', borderColor: '#ffffff20', fontSize: '12px' }}
                    itemStyle={{ color: '#e4e4e7' }}
                  />
                  <Area type="monotone" dataKey="users" stroke="#3b82f6" fillOpacity={1} fill="url(#colorUsers)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-sm text-zinc-600">No data</div>
            )}
          </div>
        </div>

        {/* Watch Events Chart */}
        <div className="bg-black/30 border border-white/10 rounded-xl p-4">
          <h2 className="text-sm font-medium text-white mb-4">Watch Events</h2>
          <div className="h-64 w-full">
            {chartsLoading ? (
               <div className="w-full h-full flex items-center justify-center">
                 <Loader2 className="w-6 h-6 animate-spin text-zinc-600" />
               </div>
            ) : charts?.chartData?.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={charts.chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorWatches" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                  <XAxis dataKey="label" stroke="#ffffff40" fontSize={10} />
                  <YAxis stroke="#ffffff40" fontSize={10} allowDecimals={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#18181b', borderColor: '#ffffff20', fontSize: '12px' }}
                    itemStyle={{ color: '#e4e4e7' }}
                  />
                  <Area type="monotone" dataKey="watches" stroke="#8b5cf6" fillOpacity={1} fill="url(#colorWatches)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-sm text-zinc-600">No data</div>
            )}
          </div>
        </div>
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
            {activityLoading && !activity ? (
              <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-zinc-600" /></div>
            ) : activity?.activeProxySessions.length === 0 ? (
              <p className="px-4 py-6 text-sm text-zinc-600 text-center">No active streams</p>
            ) : (
              activity?.activeProxySessions.map((s) => (
                <div key={s.id} className="px-4 py-2.5 flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-xs text-zinc-300 font-mono truncate">{s.user_id.slice(0, 8)}…</p>
                    <p className="text-xs text-zinc-600 truncate">{s.ip_address || 'unknown IP'}</p>
                  </div>
                  <span className="text-xs text-zinc-500 shrink-0 ml-3">
                    {formatRelativeTime(s.last_activity)}
                  </span>
                </div>
              ))
            )}
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
            {activityLoading && !activity ? (
               <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-zinc-600" /></div>
            ) : activity?.recentWatchEvents.length === 0 ? (
              <p className="px-4 py-6 text-sm text-zinc-600 text-center">No recent activity</p>
            ) : (
              activity?.recentWatchEvents.map((e) => (
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
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
