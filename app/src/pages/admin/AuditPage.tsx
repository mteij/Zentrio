import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, ChevronDown, ChevronRight as ChevronRightIcon, ShieldCheck, Loader2, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '../../components/ui/Button'
import { useStepUp } from '../../components/admin/StepUpModal'
import { adminApi, AdminApiError, AdminAuditEntry } from '../../lib/adminApi'

const LIMIT = 50

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit'
  })
}

function JsonBlock({ json }: { json: string | null | undefined }) {
  if (!json) return <span className="text-zinc-600 italic">—</span>
  try {
    const parsed = JSON.parse(json)
    return (
      <pre className="text-xs text-emerald-400 font-mono whitespace-pre-wrap break-all bg-black/30 rounded p-2 mt-1">
        {JSON.stringify(parsed, null, 2)}
      </pre>
    )
  } catch {
    return <span className="text-xs text-zinc-400 font-mono">{json}</span>
  }
}

function AuditRow({ entry }: { entry: AdminAuditEntry }) {
  const [expanded, setExpanded] = useState(false)
  const hasDetail = !!(entry.before_json || entry.after_json || entry.reason)

  return (
    <>
      <tr
        className={`border-b border-white/5 hover:bg-white/5 transition-colors ${hasDetail ? 'cursor-pointer' : ''}`}
        onClick={() => hasDetail && setExpanded((e) => !e)}
      >
        <td className="px-4 py-2.5 text-xs text-zinc-500 whitespace-nowrap">{formatDate(entry.created_at)}</td>
        <td className="px-4 py-2.5">
          <span className="text-xs font-mono text-zinc-300">{entry.actor_id.slice(0, 8)}…</span>
        </td>
        <td className="px-4 py-2.5">
          <span className="text-xs font-mono text-amber-400">{entry.action}</span>
        </td>
        <td className="px-4 py-2.5 text-xs text-zinc-500 hidden md:table-cell">
          {entry.target_type && <span>{entry.target_type}</span>}
          {entry.target_id && <span className="font-mono ml-1">{entry.target_id.slice(0, 8)}…</span>}
        </td>
        <td className="px-4 py-2.5 hidden lg:table-cell text-xs text-zinc-600 truncate max-w-[120px]">
          {entry.ip_address}
        </td>
        <td className="px-4 py-2.5 w-6">
          {hasDetail && (
            expanded
              ? <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
              : <ChevronRightIcon className="w-3.5 h-3.5 text-zinc-500" />
          )}
        </td>
      </tr>
      {expanded && hasDetail && (
        <tr className="bg-black/20 border-b border-white/5">
          <td colSpan={6} className="px-6 py-3 space-y-2">
            {entry.reason && (
              <p className="text-xs text-zinc-300"><span className="text-zinc-500">Reason:</span> {entry.reason}</p>
            )}
            {entry.before_json && (
              <div>
                <span className="text-xs text-zinc-500">Before:</span>
                <JsonBlock json={entry.before_json} />
              </div>
            )}
            {entry.after_json && (
              <div>
                <span className="text-xs text-zinc-500">After:</span>
                <JsonBlock json={entry.after_json} />
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  )
}

export function AuditPage() {
  const { requireStepUp } = useStepUp()
  const [offset, setOffset] = useState(0)
  const [actionFilter, setActionFilter] = useState('')
  const [verifyResult, setVerifyResult] = useState<{ valid: boolean; message: string } | null>(null)
  const [verifying, setVerifying] = useState(false)

  const { data: logsData, isLoading: logsLoading } = useQuery({
    queryKey: ['admin-audit', actionFilter, offset],
    queryFn: () => adminApi.getAuditLog({ action: actionFilter || undefined }, LIMIT, offset),
  })

  const { data: statsData } = useQuery({
    queryKey: ['admin-audit-stats'],
    queryFn: () => adminApi.getAuditStats(),
  })

  const logs = logsData?.logs ?? []
  const total = logsData?.total ?? 0
  const totalPages = Math.ceil(total / LIMIT)
  const currentPage = Math.floor(offset / LIMIT) + 1
  const topActions = statsData?.byAction?.slice(0, 5) ?? []

  const handleVerifyChain = async () => {
    setVerifyResult(null)
    const ok = await requireStepUp()
    if (!ok) return
    setVerifying(true)
    try {
      const result = await adminApi.verifyAuditChain()
      setVerifyResult(result)
    } catch (e) {
      const msg = e instanceof AdminApiError ? e.message : 'Verification failed'
      toast.error(msg)
    } finally {
      setVerifying(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-semibold text-white">Audit Log</h1>
        <Button
          variant="secondary"
          onClick={handleVerifyChain}
          disabled={verifying}
          className="flex items-center gap-1.5 text-sm"
        >
          {verifying
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Verifying…</>
            : <><ShieldCheck className="w-4 h-4" /> Verify Chain Integrity</>
          }
        </Button>
      </div>

      {/* Chain verification result */}
      {verifyResult && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-lg border text-sm ${
          verifyResult.valid
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
            : 'bg-red-500/10 border-red-500/20 text-red-400'
        }`}>
          {verifyResult.valid ? <ShieldCheck className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
          {verifyResult.message}
        </div>
      )}

      {/* Stats strip */}
      {statsData && (
        <div className="bg-black/30 border border-white/10 rounded-xl px-4 py-3 flex flex-wrap gap-4 text-xs text-zinc-500">
          <span><span className="text-white font-medium">{statsData.total}</span> total events</span>
          <span><span className="text-white font-medium">{statsData.uniqueActors}</span> unique actors</span>
          {topActions.map((a) => (
            <button
              key={a.action}
              onClick={() => { setActionFilter(a.action === actionFilter ? '' : a.action); setOffset(0) }}
              className={`transition-colors hover:text-white ${actionFilter === a.action ? 'text-amber-400' : ''}`}
            >
              {a.action} <span className="text-zinc-600">({a.count})</span>
            </button>
          ))}
          {actionFilter && (
            <button onClick={() => { setActionFilter(''); setOffset(0) }} className="text-red-400 hover:text-red-300 transition-colors">
              Clear filter ×
            </button>
          )}
        </div>
      )}

      {/* Log table */}
      <div className="bg-black/30 border border-white/10 rounded-xl overflow-hidden">
        {logsLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-zinc-500" />
          </div>
        ) : logs.length === 0 ? (
          <p className="text-center py-12 text-zinc-600 text-sm">No audit entries found</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10 text-left">
                <th className="px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Time</th>
                <th className="px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Actor</th>
                <th className="px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Action</th>
                <th className="px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider hidden md:table-cell">Target</th>
                <th className="px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider hidden lg:table-cell">IP</th>
                <th className="px-4 py-3 w-6"></th>
              </tr>
            </thead>
            <tbody>
              {logs.map((entry) => (
                <AuditRow key={entry.id} entry={entry} />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-zinc-500">
          <span>Page {currentPage} of {totalPages} ({total} entries)</span>
          <div className="flex gap-2">
            <button
              onClick={() => setOffset(Math.max(0, offset - LIMIT))}
              disabled={offset === 0}
              className="p-1.5 rounded hover:bg-white/10 transition-colors disabled:opacity-30"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setOffset(offset + LIMIT)}
              disabled={offset + LIMIT >= total}
              className="p-1.5 rounded hover:bg-white/10 transition-colors disabled:opacity-30"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
