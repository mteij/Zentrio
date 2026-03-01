import { useEffect } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Shield, BarChart3, Users, ScrollText, ArrowLeft, Loader2 } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { SimpleLayout, AnimatedBackground } from '../../components'
import { StepUpProvider } from '../../components/admin/StepUpModal'
import { adminApi, AdminApiError } from '../../lib/adminApi'

const navItems = [
  { to: '/admin', label: 'Dashboard', icon: BarChart3, end: true },
  { to: '/admin/users', label: 'Users', icon: Users, end: false },
  { to: '/admin/audit', label: 'Audit Log', icon: ScrollText, end: false },
]

export function AdminLayout() {
  const navigate = useNavigate()

  const { data: me, isLoading, error } = useQuery({
    queryKey: ['admin-me'],
    queryFn: () => adminApi.getMe(),
    retry: false,
  })

  useEffect(() => {
    if (error instanceof AdminApiError && (error.status === 401 || error.status === 403)) {
      navigate('/profiles', { replace: true })
    }
  }, [error, navigate])

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
