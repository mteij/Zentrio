import { useState, useEffect, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Search, ChevronLeft, ChevronRight, X, Loader2, ShieldCheck, Ban, UserCheck, Shield } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '../../components/ui/Button'
import { InputDialog } from '../../components/ui/InputDialog'
import { useStepUp } from '../../components/admin/StepUpModal'
import { adminApi, AdminApiError, AdminUser, AdminAuditEntry, AdminUserRole } from '../../lib/adminApi'

const LIMIT = 25

function RoleBadge({ role }: { role?: string }) {
  const r = (role || 'user').toLowerCase()
  const cls = r === 'admin'
    ? 'bg-red-500/20 text-red-400 border-red-500/20'
    : 'bg-zinc-700/40 text-zinc-400 border-zinc-600/30'
  return (
    <span className={`px-1.5 py-0.5 rounded text-xs border ${cls}`}>{r}</span>
  )
}

function StatusBadge({ banned }: { banned?: boolean }) {
  return banned
    ? <span className="px-1.5 py-0.5 rounded text-xs bg-red-500/20 text-red-400 border border-red-500/20">Banned</span>
    : <span className="px-1.5 py-0.5 rounded text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/20">Active</span>
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

// ── User Detail Drawer ────────────────────────────────────────────────────────

interface DrawerProps {
  userId: string
  onClose: () => void
  onAction: () => void
}

function UserDrawer({ userId, onClose, onAction }: DrawerProps) {
  const { requireStepUp } = useStepUp()
  const qc = useQueryClient()
  const [reasonDialog, setReasonDialog] = useState<'role' | 'ban' | 'unban' | null>(null)
  const [targetRole, setTargetRole] = useState<string>('')

  const { data, isLoading } = useQuery({
    queryKey: ['admin-user', userId],
    queryFn: () => adminApi.getUser(userId),
  })

  const user = data?.user
  const roles: AdminUserRole[] = data?.roles ?? []
  const recentActivity: AdminAuditEntry[] = data?.recentActivity ?? []

  const doWithStepUp = async (fn: () => Promise<unknown>) => {
    const ok = await requireStepUp()
    if (!ok) return
    try {
      await fn()
      qc.invalidateQueries({ queryKey: ['admin-users'] })
      qc.invalidateQueries({ queryKey: ['admin-user', userId] })
      onAction()
    } catch (e) {
      toast.error(e instanceof AdminApiError ? e.message : 'Action failed')
    }
  }

  const handleRoleChange = async (reason: string) => {
    await doWithStepUp(() => adminApi.setUserRole(userId, targetRole, reason))
    toast.success(`Role changed to ${targetRole}`)
  }

  const handleBan = async (banReason: string) => {
    await doWithStepUp(() => adminApi.banUser(userId, banReason))
    toast.success('User banned')
  }

  const handleUnban = async (reason: string) => {
    await doWithStepUp(() => adminApi.unbanUser(userId, reason))
    toast.success('User unbanned')
  }

  return (
    <>
      <div className="fixed inset-0 z-30" onClick={onClose} />
      <aside className="fixed right-0 top-0 bottom-0 z-40 w-full max-w-sm bg-zinc-900 border-l border-white/10 flex flex-col shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <h2 className="font-medium text-white text-sm">User Detail</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-zinc-500" />
          </div>
        ) : user ? (
          <div className="flex-1 overflow-y-auto divide-y divide-white/5">
            {/* Identity */}
            <div className="px-4 py-4 space-y-1">
              <p className="font-medium text-white">{user.name}</p>
              <p className="text-sm text-zinc-400">{user.email}</p>
              <div className="flex gap-2 mt-2">
                <RoleBadge role={user.role} />
                <StatusBadge banned={user.banned} />
              </div>
              <p className="text-xs text-zinc-600 mt-1">Joined {formatDate(user.createdAt)}</p>
              {user.banReason && (
                <p className="text-xs text-red-400 mt-1">Ban reason: {user.banReason}</p>
              )}
            </div>

            {/* RBAC Roles */}
            {roles.length > 0 && (
              <div className="px-4 py-3 space-y-1">
                <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">RBAC Roles</p>
                {roles.map((r) => (
                  <div key={r.id} className="flex items-center gap-2">
                    <Shield className="w-3 h-3 text-amber-400" />
                    <span className="text-sm text-zinc-300">{r.name}</span>
                    {r.description && <span className="text-xs text-zinc-600">— {r.description}</span>}
                  </div>
                ))}
              </div>
            )}

            {/* Actions */}
            <div className="px-4 py-3 space-y-2">
              <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Actions</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  className="text-xs !py-1.5"
                  onClick={() => { setTargetRole(user.role === 'admin' ? 'user' : 'admin'); setReasonDialog('role') }}
                >
                  <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                  {user.role === 'admin' ? 'Demote to User' : 'Promote to Admin'}
                </Button>
                {user.banned ? (
                  <Button variant="secondary" className="text-xs !py-1.5" onClick={() => setReasonDialog('unban')}>
                    <UserCheck className="w-3.5 h-3.5 mr-1" />
                    Unban
                  </Button>
                ) : (
                  <Button variant="danger" className="text-xs !py-1.5" onClick={() => setReasonDialog('ban')}>
                    <Ban className="w-3.5 h-3.5 mr-1" />
                    Ban
                  </Button>
                )}
              </div>
            </div>

            {/* Recent audit activity */}
            {recentActivity.length > 0 && (
              <div className="px-4 py-3">
                <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Recent Audit Activity</p>
                <div className="space-y-1.5">
                  {recentActivity.slice(0, 5).map((entry) => (
                    <div key={entry.id} className="text-xs text-zinc-400">
                      <span className="font-mono text-zinc-500">{entry.action}</span>
                      {entry.reason && <span className="ml-1 text-zinc-600">— {entry.reason}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-zinc-600 text-sm">User not found</div>
        )}
      </aside>

      {/* Reason dialogs */}
      <InputDialog
        isOpen={reasonDialog === 'role'}
        onClose={() => setReasonDialog(null)}
        onSubmit={handleRoleChange}
        title="Role Change Reason"
        message={`Changing role to "${targetRole}". Please provide a reason.`}
        placeholder="Enter reason..."
        confirmText="Change Role"
        validation={(v) => v.trim().length < 3 ? 'Reason must be at least 3 characters' : null}
      />
      <InputDialog
        isOpen={reasonDialog === 'ban'}
        onClose={() => setReasonDialog(null)}
        onSubmit={handleBan}
        title="Ban User"
        message="Provide a reason for banning this user."
        placeholder="Enter ban reason..."
        confirmText="Ban User"
        validation={(v) => v.trim().length < 3 ? 'Reason must be at least 3 characters' : null}
      />
      <InputDialog
        isOpen={reasonDialog === 'unban'}
        onClose={() => setReasonDialog(null)}
        onSubmit={handleUnban}
        title="Unban User"
        message="Provide a reason for unbanning this user."
        placeholder="Enter reason..."
        confirmText="Unban"
        validation={(v) => v.trim().length < 3 ? 'Reason must be at least 3 characters' : null}
      />
    </>
  )
}

// ── Main Users Page ───────────────────────────────────────────────────────────

export function UsersPage() {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [offset, setOffset] = useState(0)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQuery(query)
      setOffset(0)
    }, 300)
    return () => clearTimeout(t)
  }, [query])

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', debouncedQuery, offset],
    queryFn: () => adminApi.listUsers({ q: debouncedQuery, limit: LIMIT, offset }),
  })

  const users = data?.users ?? []
  const total = data?.pagination.total ?? 0
  const totalPages = Math.ceil(total / LIMIT)
  const currentPage = Math.floor(offset / LIMIT) + 1

  const handleQueryChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value)
  }, [])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-white">Users</h1>
        <span className="text-sm text-zinc-500">{total} total</span>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={handleQueryChange}
          placeholder="Search by email or name..."
          className="w-full pl-9 pr-4 py-2 bg-black/30 border border-white/10 rounded-lg text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-white/25 transition-colors"
        />
      </div>

      {/* Table */}
      <div className="bg-black/30 border border-white/10 rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-zinc-500" />
          </div>
        ) : users.length === 0 ? (
          <p className="text-center py-12 text-zinc-600 text-sm">No users found</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left">
                <th className="px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">User</th>
                <th className="px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider hidden sm:table-cell">Role</th>
                <th className="px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider hidden md:table-cell">Status</th>
                <th className="px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider hidden lg:table-cell">Joined</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {users.map((user: AdminUser) => (
                <tr key={user.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3">
                    <p className="text-white font-medium truncate max-w-[180px]">{user.name}</p>
                    <p className="text-zinc-500 text-xs truncate max-w-[180px]">{user.email}</p>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <RoleBadge role={user.role} />
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <StatusBadge banned={user.banned} />
                  </td>
                  <td className="px-4 py-3 text-zinc-500 text-xs hidden lg:table-cell">
                    {formatDate(user.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setSelectedUserId(user.id)}
                      className="text-xs text-zinc-400 hover:text-white transition-colors px-2 py-1 rounded hover:bg-white/10"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-zinc-500">
          <span>Page {currentPage} of {totalPages}</span>
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

      {/* User detail drawer */}
      {selectedUserId && (
        <UserDrawer
          userId={selectedUserId}
          onClose={() => setSelectedUserId(null)}
          onAction={() => setSelectedUserId(null)}
        />
      )}
    </div>
  )
}
