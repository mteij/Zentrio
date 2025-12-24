import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Check, X, Library, LogIn, UserPlus, Loader2 } from 'lucide-react'
import { Layout } from '../components'
import { apiFetch } from '../lib/apiFetch'
import { useAuthStore } from '../stores/authStore'
import { toast } from 'sonner'

interface ShareInfo {
  share: {
    id: number
    status: string
    permission: string
    created_at: string
    expires_at?: string
  }
  list: {
    id: number
    name: string
  } | null
  itemCount: number
  sharedBy: {
    name: string
  } | null
}

export function ShareInvitePage() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const { isAuthenticated, isLoading: authLoading } = useAuthStore()
  const [shareInfo, setShareInfo] = useState<ShareInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    if (token) {
      loadShareInfo()
    }
  }, [token])

  const loadShareInfo = async () => {
    try {
      const res = await apiFetch(`/api/lists/share/${token}`)
      if (res.ok) {
        const data = await res.json()
        setShareInfo(data)
      } else {
        const data = await res.json()
        setError(data.error || 'Share not found')
      }
    } catch (e) {
      console.error(e)
      setError('Failed to load share information')
    } finally {
      setLoading(false)
    }
  }

  const handleAccept = async () => {
    if (!isAuthenticated) {
      // Store intention and redirect to login
      localStorage.setItem('pendingShareToken', token || '')
      navigate('/signin?redirect=' + encodeURIComponent(`/share/${token}`))
      return
    }

    setProcessing(true)
    try {
      const res = await apiFetch(`/api/lists/share/${token}/accept`, { method: 'POST' })
      if (res.ok) {
        toast.success('List added to your library!')
        navigate('/profiles')
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to accept share')
      }
    } catch (e) {
      console.error(e)
      toast.error('Failed to accept share')
    } finally {
      setProcessing(false)
    }
  }

  const handleDecline = async () => {
    setProcessing(true)
    try {
      await apiFetch(`/api/lists/share/${token}/decline`, { method: 'POST' })
      toast.info('Invitation declined')
      navigate('/')
    } catch (e) {
      console.error(e)
      toast.error('Failed to decline')
    } finally {
      setProcessing(false)
    }
  }

  if (loading) {
    return (
      <Layout title="Share Invitation" showHeader={false} showFooter={false}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #0a0a0a 100%)',
          color: '#fff'
        }}>
          <Loader2 size={48} className="animate-spin" style={{ color: '#e50914' }} />
          <p style={{ marginTop: '16px', color: '#888' }}>Loading invitation...</p>
        </div>
      </Layout>
    )
  }

  if (error) {
    return (
      <Layout title="Share Invitation" showHeader={false} showFooter={false}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #0a0a0a 100%)',
          color: '#fff',
          padding: '20px'
        }}>
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '12px',
            padding: '24px 32px',
            textAlign: 'center',
            maxWidth: '400px'
          }}>
            <X size={48} style={{ color: '#ef4444', marginBottom: '16px' }} />
            <h2 style={{ margin: '0 0 8px', color: '#fff', fontSize: '1.5rem' }}>Invitation Not Found</h2>
            <p style={{ color: '#999', margin: 0 }}>{error}</p>
            <Link 
              to="/" 
              style={{
                display: 'inline-block',
                marginTop: '20px',
                color: '#e50914',
                textDecoration: 'none'
              }}
            >
              Go to Home
            </Link>
          </div>
        </div>
      </Layout>
    )
  }

  if (!shareInfo || shareInfo.share.status !== 'pending') {
    return (
      <Layout title="Share Invitation" showHeader={false} showFooter={false}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #0a0a0a 100%)',
          color: '#fff',
          padding: '20px'
        }}>
          <div style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '12px',
            padding: '24px 32px',
            textAlign: 'center',
            maxWidth: '400px'
          }}>
            <Library size={48} style={{ color: '#888', marginBottom: '16px' }} />
            <h2 style={{ margin: '0 0 8px', color: '#fff', fontSize: '1.5rem' }}>Invitation Already Processed</h2>
            <p style={{ color: '#999', margin: 0 }}>
              This invitation has already been {shareInfo?.share.status || 'processed'}.
            </p>
            <Link 
              to="/profiles" 
              style={{
                display: 'inline-block',
                marginTop: '20px',
                color: '#e50914',
                textDecoration: 'none'
              }}
            >
              Go to Profiles
            </Link>
          </div>
        </div>
      </Layout>
    )
  }

  const getPermissionDescription = (perm: string) => {
    switch (perm) {
      case 'read': return 'View items in this list'
      case 'add': return 'View and add items to this list'
      case 'full': return 'View, add, and remove items from this list'
      default: return 'Access this list'
    }
  }

  return (
    <Layout title="Share Invitation" showHeader={false} showFooter={false}>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0a0a0a 0%, #16213e 50%, #0a0a0a 100%)',
        color: '#fff',
        padding: '20px'
      }}>
        <div style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '16px',
          padding: '32px 40px',
          textAlign: 'center',
          maxWidth: '450px',
          width: '100%'
        }}>
          {/* Header */}
          <div style={{
            width: '80px',
            height: '80px',
            background: 'linear-gradient(135deg, #e50914 0%, #b20710 100%)',
            borderRadius: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 24px'
          }}>
            <Library size={40} style={{ color: '#fff' }} />
          </div>

          <h1 style={{ margin: '0 0 8px', fontSize: '1.75rem', fontWeight: '700' }}>
            You've been invited!
          </h1>
          
          <p style={{ color: '#999', marginBottom: '24px' }}>
            <strong style={{ color: '#fff' }}>{shareInfo.sharedBy?.name || 'Someone'}</strong> wants to share their list with you
          </p>

          {/* List info */}
          <div style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '12px',
            padding: '20px',
            marginBottom: '24px'
          }}>
            <h2 style={{ margin: '0 0 8px', fontSize: '1.25rem', color: '#e50914' }}>
              "{shareInfo.list?.name || 'Unknown List'}"
            </h2>
            <p style={{ margin: '0 0 12px', color: '#888', fontSize: '0.9rem' }}>
              {shareInfo.itemCount} {shareInfo.itemCount === 1 ? 'item' : 'items'}
            </p>
            <p style={{ margin: 0, color: '#a5b4fc', fontSize: '0.85rem' }}>
              {getPermissionDescription(shareInfo.share.permission)}
            </p>
          </div>

          {/* Auth state */}
          {authLoading ? (
            <div style={{ color: '#888', padding: '20px' }}>
              <Loader2 size={24} className="animate-spin" />
            </div>
          ) : !isAuthenticated ? (
            <>
              <p style={{ color: '#888', fontSize: '0.9rem', marginBottom: '20px' }}>
                Sign in or create an account to accept this invitation
              </p>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                <Link
                  to={`/signin?redirect=${encodeURIComponent(`/share/${token}`)}`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: '#e50914',
                    color: '#fff',
                    padding: '12px 24px',
                    borderRadius: '8px',
                    textDecoration: 'none',
                    fontWeight: '600'
                  }}
                >
                  <LogIn size={18} />
                  Sign In
                </Link>
                <Link
                  to={`/register?redirect=${encodeURIComponent(`/share/${token}`)}`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: 'rgba(255,255,255,0.1)',
                    color: '#fff',
                    padding: '12px 24px',
                    borderRadius: '8px',
                    textDecoration: 'none',
                    fontWeight: '500',
                    border: '1px solid rgba(255,255,255,0.2)'
                  }}
                >
                  <UserPlus size={18} />
                  Sign Up
                </Link>
              </div>
            </>
          ) : (
            /* Action buttons for authenticated users */
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={handleAccept}
                disabled={processing}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: '#22c55e',
                  color: '#fff',
                  padding: '12px 28px',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '1rem',
                  opacity: processing ? 0.7 : 1
                }}
              >
                <Check size={18} />
                Accept
              </button>
              <button
                onClick={handleDecline}
                disabled={processing}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'rgba(239, 68, 68, 0.1)',
                  color: '#f87171',
                  padding: '12px 28px',
                  borderRadius: '8px',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  cursor: 'pointer',
                  fontWeight: '500',
                  fontSize: '1rem',
                  opacity: processing ? 0.7 : 1
                }}
              >
                <X size={18} />
                Decline
              </button>
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
