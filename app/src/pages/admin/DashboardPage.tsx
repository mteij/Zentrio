import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Ban, Eye, Globe, LayoutGrid, Loader2, Monitor, MonitorPlay, RefreshCw, ShieldCheck, Users, Zap } from 'lucide-react'
import { useState } from 'react'
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { adminApi, type PlatformStats } from '../../lib/adminApi'

// ── Client distribution colours ──────────────────────────────────────────────

const PLATFORM_COLORS: Record<string, string> = {
  'Tauri (Windows)': '#f59e0b',
  'Tauri (macOS)':   '#fb923c',
  'Tauri (Linux)':   '#f97316',
  'Tauri (Android)': '#10b981',
  'Tauri (iOS)':     '#818cf8',
  'Tauri (Desktop)': '#d97706',
  'Windows':         '#3b82f6',
  'macOS':           '#a78bfa',
  'Linux':           '#22d3ee',
  'Android':         '#4ade80',
  'iOS':             '#f472b6',
  'Other':           '#3f3f46',
}

const BROWSER_COLORS: Record<string, string> = {
  'Chrome':  '#fbbf24',
  'Firefox': '#fb923c',
  'Safari':  '#60a5fa',
  'Edge':    '#818cf8',
  'Opera':   '#f87171',
  'Other':   '#3f3f46',
}

const platformColor = (name: string) => PLATFORM_COLORS[name] ?? '#3f3f46'
const browserColor  = (name: string) => BROWSER_COLORS[name]  ?? '#3f3f46'
const isTauriPlatform = (name: string) => name.startsWith('Tauri')
const TIME_RANGE_LABELS = {
  '24h': 'Last 24 hours',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  'all': 'All time',
} as const

// ── ClientDistribution widget ─────────────────────────────────────────────────

function ClientDistribution({
  data,
  loading,
  rangeLabel,
}: {
  data: PlatformStats | undefined
  loading: boolean
  rangeLabel: string
}) {
  if (loading && !data) {
    return (
      <div className="bg-black/30 border border-white/10 rounded-xl p-6 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-600" />
      </div>
    )
  }

  if (data?.disabled) {
    return (
      <div className="bg-black/30 border border-white/10 rounded-xl p-6 flex items-center justify-center">
        <p className="text-sm text-zinc-600">Analytics disabled</p>
      </div>
    )
  }

  if (!data || data.total === 0) {
    return (
      <div className="bg-black/30 border border-white/10 rounded-xl p-6 flex items-center justify-center">
        <p className="text-sm text-zinc-600">No session data yet</p>
      </div>
    )
  }

  const webTotal    = data.browsers.reduce((s, b) => s + b.count, 0)
  const nativeTotal = data.total - webTotal
  const nativePct   = data.total > 0 ? Math.round((nativeTotal / data.total) * 100) : 0
  const webPct      = 100 - nativePct

  return (
    <div className="bg-black/30 border border-white/10 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
        <Monitor className="w-4 h-4 text-zinc-400" />
        <span className="text-sm font-medium text-white">Client Distribution</span>
        <span className="ml-auto text-xs text-zinc-600 tabular-nums">{data.total} sessions</span>
      </div>

      {/* Native vs Web segmented bar */}
      <div className="px-4 pt-3 pb-1">
        <p className="mb-2 text-[11px] uppercase tracking-[0.18em] text-zinc-600">{rangeLabel}</p>
        <div className="flex rounded-full overflow-hidden h-1.5 mb-2">
          {nativePct > 0 && (
            <div
              className="h-full transition-all duration-700"
              style={{ width: `${nativePct}%`, background: 'linear-gradient(90deg, #f59e0b, #fb923c)' }}
            />
          )}
          {webPct > 0 && (
            <div
              className="h-full transition-all duration-700"
              style={{ width: `${webPct}%`, background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)' }}
            />
          )}
        </div>
        <div className="flex items-center gap-4 text-xs text-zinc-500">
          {nativeTotal > 0 && (
            <span className="flex items-center gap-1.5">
              <Zap className="w-3 h-3 text-amber-400" />
              Native app — {nativePct}%
            </span>
          )}
          {webTotal > 0 && (
            <span className="flex items-center gap-1.5">
              <Globe className="w-3 h-3 text-blue-400" />
              Web browser — {webPct}%
            </span>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="p-4 grid grid-cols-1 xl:grid-cols-2 gap-5">

        {/* Left: donut + platform legend */}
        <div>
          <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider mb-3">Platforms</p>

          {/* Donut chart */}
          <div className="relative h-40 sm:h-44">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.platforms}
                  cx="50%"
                  cy="50%"
                  innerRadius={48}
                  outerRadius={72}
                  paddingAngle={2}
                  dataKey="count"
                  nameKey="name"
                  startAngle={90}
                  endAngle={-270}
                  strokeWidth={0}
                >
                  {data.platforms.map((p) => (
                    <Cell key={p.name} fill={platformColor(p.name)} opacity={0.9} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#18181b', borderColor: '#ffffff15', fontSize: '12px', borderRadius: '8px' }}
                  itemStyle={{ color: '#e4e4e7' }}
                  formatter={(value, name) => [`${value} session${value !== 1 ? 's' : ''}`, String(name)]}
                />
              </PieChart>
            </ResponsiveContainer>

            {/* Center label — sits on top of the donut hole */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
              <span className="text-2xl font-bold text-white tabular-nums leading-none">{data.total}</span>
              <span className="text-[11px] text-zinc-500 mt-0.5">sessions</span>
            </div>
          </div>

          {/* Platform legend */}
          <div className="mt-3 space-y-1.5">
            {data.platforms.map(({ name, count }) => {
              const pct   = Math.round((count / data.total) * 100)
              const color = platformColor(name)
              const native = isTauriPlatform(name)
              return (
                <div key={name} className="flex items-center gap-2 group">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                  <span className="text-xs text-zinc-300 flex-1 truncate">
                    {name}
                    {native && (
                      <span className="ml-1.5 text-[10px] text-amber-400/50 font-medium">app</span>
                    )}
                  </span>
                  <span className="text-xs text-zinc-500 tabular-nums shrink-0">{count}</span>
                  <span className="text-xs text-zinc-700 tabular-nums shrink-0 w-8 text-right">{pct}%</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Right: browser bars */}
        <div>
          <div className="flex items-center gap-1.5 mb-3">
            <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider flex-1">Web Browsers</p>
            {webTotal > 0 && (
              <span className="text-xs text-zinc-700 tabular-nums">{webTotal} sessions</span>
            )}
          </div>

          {data.browsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 gap-2">
              {nativeTotal > 0 ? (
                <>
                  <Zap className="w-5 h-5 text-amber-400/40" />
                  <p className="text-xs text-zinc-600 text-center">All sessions are from<br />the native app</p>
                </>
              ) : (
                <p className="text-xs text-zinc-600">No web sessions yet</p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {data.browsers.map(({ name, count }) => {
                const pct   = webTotal > 0 ? Math.round((count / webTotal) * 100) : 0
                const color = browserColor(name)
                return (
                  <div key={name}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                        <span className="text-xs text-zinc-300">{name}</span>
                      </div>
                      <span className="text-xs text-zinc-500 tabular-nums">
                        {count} <span className="text-zinc-700">({pct}%)</span>
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${pct}%`, backgroundColor: color, opacity: 0.75 }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

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

function formatMetaId(metaId: string): string {
  // meta_id can be a comma-separated list of addon stream IDs; take the first recognizable one
  const first = metaId.split(',')[0]
  // Known prefixes: tmdb:123, tt1234567, tbm:hash, mg_123, etc.
  const tmdb = first.match(/^tmdb:(\d+)$/)
  if (tmdb) return `TMDB #${tmdb[1]}`
  const imdb = first.match(/^(tt\d+)$/)
  if (imdb) return imdb[1]
  // Fallback: truncate to 30 chars
  return first.length > 30 ? `${first.slice(0, 30)}…` : first
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

  const { data: platformStats, isLoading: platformLoading } = useQuery({
    queryKey: ['admin-platform-stats', timeRange],
    queryFn: () => adminApi.getPlatformStats(timeRange),
    refetchInterval: 60_000,
  })

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['admin-stats'] })
    qc.invalidateQueries({ queryKey: ['admin-activity'] })
    qc.invalidateQueries({ queryKey: ['admin-charts'] })
    qc.invalidateQueries({ queryKey: ['admin-platform-stats'] })
  }

  const isLoading = statsLoading || activityLoading || chartsLoading || platformLoading

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold text-white">Dashboard</h1>
        <div className="flex w-full items-center gap-2 sm:w-auto sm:gap-4">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as any)}
            className="min-w-0 flex-1 bg-black/30 border border-white/10 text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-400 sm:flex-none"
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
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
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
          <div className="h-56 sm:h-64 w-full">
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
          <div className="h-56 sm:h-64 w-full">
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

      {/* Platform / client distribution */}
      <ClientDistribution
        data={platformStats}
        loading={platformLoading}
        rangeLabel={TIME_RANGE_LABELS[timeRange]}
      />

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
                    <p className="text-xs text-zinc-300 truncate">{e.title || formatMetaId(e.meta_id)}</p>
                    <p className="text-xs text-zinc-600 capitalize">
                      {e.meta_type}{e.season != null && e.season >= 0 && e.episode != null && e.episode >= 0 ? ` S${e.season}E${e.episode}` : ''}
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
