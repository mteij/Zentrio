import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Shield, BarChart3, Users, ScrollText, ArrowLeft, Loader2, Activity } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { SimpleLayout, AnimatedBackground } from '../../components'
import { StepUpProvider } from '../../components/admin/StepUpModal'
import { adminApi, AdminApiError } from '../../lib/adminApi'

const navItems = [
  { to: '/admin', label: 'Dashboard', icon: BarChart3, end: true },
  { to: '/admin/system', label: 'System Health', icon: Activity, end: false },
  { to: '/admin/users', label: 'Users', icon: Users, end: false },
  { to: '/admin/audit', label: 'Audit Log', icon: ScrollText, end: false },
]

function SetupScreen({ requiresSetupToken }: { requiresSetupToken: boolean }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [claimed, setClaimed] = useState(false)
  const [setupToken, setSetupToken] = useState('')

  const { mutate: claim, isPending, error } = useMutation({
    mutationFn: () => adminApi.claimSetup(requiresSetupToken ? setupToken : undefined),
    onSuccess: () => {
      setClaimed(true)
      queryClient.invalidateQueries({ queryKey: ['admin-status'] })
      queryClient.invalidateQueries({ queryKey: ['admin-me'] })
    },
  })

  if (claimed) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <Shield className="w-12 h-12 text-green-400 mx-auto" />
          <h1 className="text-2xl font-bold text-white">Setup Complete</h1>
          <p className="text-zinc-400">You are now the superadmin of this instance.</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors text-sm"
          >
            Continue to Admin Console
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="max-w-md w-full mx-4 space-y-6">
        <div className="text-center space-y-2">
          <Shield className="w-12 h-12 text-red-400 mx-auto" />
          <h1 className="text-2xl font-bold text-white">Admin Setup</h1>
          <p className="text-zinc-400 text-sm">
            No admin has claimed this instance yet. As the logged-in user, you can claim superadmin access now.
          </p>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-4">
          <div className="text-xs text-zinc-500 space-y-1">
            <p>This setup endpoint closes permanently once claimed.</p>
            <p>Make sure you are the intended instance owner before proceeding.</p>
          </div>

          {requiresSetupToken && (
            <input
              type="password"
              placeholder="Setup token"
              value={setupToken}
              onChange={(e) => setSetupToken(e.target.value)}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-white/30"
            />
          )}

          {error instanceof AdminApiError && (
            <p className="text-red-400 text-sm">{error.message}</p>
          )}

          <button
            onClick={() => claim()}
            disabled={isPending || (requiresSetupToken && !setupToken.trim())}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white rounded-lg transition-colors font-medium text-sm"
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
            Claim Admin Access
          </button>

          <button
            onClick={() => navigate('/profiles')}
            className="w-full px-4 py-2 text-zinc-400 hover:text-white text-sm transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

export function AdminLayout() {
  const navigate = useNavigate()

  const { data: status } = useQuery({
    queryKey: ['admin-status'],
    queryFn: () => adminApi.getStatus(),
    staleTime: 30_000,
    retry: false,
  })

  const { data: me, isLoading, error } = useQuery({
    queryKey: ['admin-me'],
    queryFn: () => adminApi.getMe(),
    retry: false,
    enabled: status?.hasOwner !== false,
  })

  useEffect(() => {
    if (error instanceof AdminApiError && (error.status === 401 || error.status === 403 || error.status === 404)) {
      navigate('/profiles', { replace: true })
    }
  }, [error, navigate])

  // Admin enabled but no owner yet — show setup screen
  if (status && status.enabled && !status.hasOwner) {
    return (
      <SimpleLayout title="Admin Setup">
        <AnimatedBackground />
        <div className="relative min-h-screen text-white">
          <SetupScreen requiresSetupToken={!!status.requiresSetupToken} />
        </div>
      </SimpleLayout>
    )
  }

  return (
    <SimpleLayout title="Admin Console">
      <AnimatedBackground />
      <div className="relative min-h-screen text-white">
        {/* Header */}
        <header className="border-b border-white/10 bg-black/40 backdrop-blur-md sticky top-0 z-20">
          <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-4">
            <button
              onClick={() => navigate('/profiles')}
              className="flex items-center gap-1.5 text-zinc-400 hover:text-white transition-colors text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
            <div className="flex items-center gap-2 flex-1">
              <Shield className="w-5 h-5 text-red-500" />
              <span className="font-semibold tracking-wide">Admin Console</span>
            </div>
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-zinc-500" />
            ) : me ? (
              <span className="text-sm text-zinc-400 hidden sm:block">
                {me.email}
                <span className="ml-2 px-1.5 py-0.5 rounded text-xs bg-red-500/20 text-red-400 border border-red-500/20">
                  {me.role}
                </span>
              </span>
            ) : null}
          </div>
        </header>

        <div className="max-w-7xl mx-auto px-4 py-6 flex gap-6">
          {/* Sidebar */}
          <nav className="w-44 shrink-0 space-y-1">
            {navItems.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-white/10 text-white'
                      : 'text-zinc-400 hover:text-white hover:bg-white/5'
                  }`
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                {label}
              </NavLink>
            ))}
          </nav>

          {/* Page content */}
          <main className="flex-1 min-w-0">
            <StepUpProvider>
              <Outlet />
            </StepUpProvider>
          </main>
        </div>
      </div>
    </SimpleLayout>
  )
}
