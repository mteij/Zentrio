import { useQuery } from '@tanstack/react-query'
import { Activity, HardDrive, Cpu, Clock, Loader2, AlertTriangle, FileText } from 'lucide-react'
import { adminApi, AdminSystemHealth } from '../../lib/adminApi'

function MetricCard({ label, value, icon: Icon, loading = false, highlight = false }: {
  label: string
  value: React.ReactNode
  icon: React.ElementType
  loading?: boolean
  highlight?: boolean
}) {
  return (
    <div className={`bg-black/30 border ${highlight ? 'border-amber-500/30' : 'border-white/10'} rounded-xl p-4 flex items-center gap-4`}>
      <div className={`p-2.5 rounded-lg ${highlight ? 'bg-amber-500/10 text-amber-400' : 'bg-white/5 text-zinc-300'}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        {loading ? (
          <div className="h-6 w-24 bg-white/10 animate-pulse rounded my-0.5" />
        ) : (
          <div className="text-xl font-bold text-white truncate">{value}</div>
        )}
        <p className="text-xs text-zinc-500 mt-0.5 truncate">{label}</p>
      </div>
    </div>
  )
}

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function formatUptime(seconds: number) {
  const d = Math.floor(seconds / (3600 * 24))
  const h = Math.floor(seconds % (3600 * 24) / 3600)
  const m = Math.floor(seconds % 3600 / 60)
  
  const parts = []
  if (d > 0) parts.push(`${d}d`)
  if (h > 0) parts.push(`${h}h`)
  if (m > 0) parts.push(`${m}m`)
  
  return parts.length > 0 ? parts.join(' ') : '< 1m'
}

// Simulated server logs for illustration since no real endpoint exists yet.
// Defined at module level to avoid calling Date.now() during render.
const now = Date.now()
const MOCK_LOGS = [
  { time: new Date(now - 12000).toISOString(), level: 'INFO', msg: 'Started background task runner' },
  { time: new Date(now - 45000).toISOString(), level: 'WARN', msg: 'High memory usage detected on main thread' },
  { time: new Date(now - 86000).toISOString(), level: 'INFO', msg: 'Addon manager synchronized successfully' },
  { time: new Date(now - 145000).toISOString(), level: 'INFO', msg: 'User profile defaults updated' },
  { time: new Date(now - 320000).toISOString(), level: 'ERROR', msg: 'Failed to retrieve metadata for tmdb:12345' },
  { time: new Date(now - 410000).toISOString(), level: 'INFO', msg: 'Database connection established securely' },
]

export function SystemPage() {
  const { data: health, isLoading, error } = useQuery<AdminSystemHealth>({
    queryKey: ['admin-system-health'],
    queryFn: () => adminApi.getSystemHealth(),
    refetchInterval: 60_000, // Refresh every 60s
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-white">System Health</h1>
        {isLoading && <Loader2 className="w-4 h-4 text-zinc-500 animate-spin" />}
      </div>

      {error ? (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-start gap-3 text-red-400">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <p className="text-sm">Failed to connect to system health service. Make sure the backend API is running.</p>
        </div>
      ) : null}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard 
          label="Server Uptime" 
          value={health ? formatUptime(health.uptime) : '—'} 
          icon={Clock} 
          loading={isLoading} 
        />
        <MetricCard 
          label="Memory (RSS)" 
          value={health ? formatBytes(health.memory.rss) : '—'} 
          icon={Activity} 
          loading={isLoading} 
          highlight={health && health.memory.rss > 500 * 1024 * 1024} // Highlight over 500MB
        />
        <MetricCard 
          label="Database Size" 
          value={health ? formatBytes(health.dbSize) : '—'} 
          icon={HardDrive} 
          loading={isLoading} 
        />
        <MetricCard 
          label="System Load (1m)" 
          value={health ? (health.os.platform === 'win32' || (health.os.platform === 'window') ? 'N/A' : health.os.loadavg[0].toFixed(2)) : '—'} 
          icon={Cpu} 
          loading={isLoading} 
        />
      </div>

      <div className="bg-black/30 border border-white/10 rounded-xl overflow-hidden flex flex-col h-[400px]">
        <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between bg-black/40">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-zinc-400" />
            <h2 className="text-sm font-medium text-white">Recent System Logs</h2>
          </div>
          <span className="text-xs text-zinc-500 font-mono tracking-widest hidden sm:block">
             OS: {health ? `${health.os.platform} ${health.os.release}` : '...'}
          </span>
        </div>
        <div className="flex-1 overflow-auto p-4 font-mono text-xs leading-relaxed space-y-1 bg-[#1a1b1e]">
          {MOCK_LOGS.map((log, i) => {
             const isError = log.level === 'ERROR'
             const isWarn = log.level === 'WARN'
             return (
               <div key={i} className={`flex gap-3 hover:bg-white/5 px-2 py-0.5 rounded transition-colors ${
                 isError ? 'text-red-400' : isWarn ? 'text-amber-400' : 'text-zinc-400'
               }`}>
                 <span className="text-zinc-500 shrink-0 w-20">
                   {new Date(log.time).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                 </span>
                 <span className={`shrink-0 w-12 font-bold ${
                   isError ? 'text-red-500' : isWarn ? 'text-amber-500' : 'text-blue-400'
                 }`}>
                   {log.level}
                 </span>
                 <span className="break-all">{log.msg}</span>
               </div>
             )
          })}
        </div>
      </div>
    </div>
  )
}
