// Linked Accounts Settings Component
// Extracted from SettingsPage.tsx
import { Check, Link } from 'lucide-react'

interface LinkedAccountsSettingsProps {
  linkedAccounts: {providerId: string, createdAt?: string}[]
  availableProviders: Record<string, boolean>
  hasPassword: boolean | null
  linkingProvider: string | null
  unlinkingProvider: string | null
  onLink: (provider: string) => void
  onUnlink: (provider: string) => void
}

export function LinkedAccountsSettings({
  linkedAccounts,
  availableProviders,
  hasPassword,
  linkingProvider,
  unlinkingProvider,
  onLink,
  onUnlink
}: LinkedAccountsSettingsProps) {

  // Check if unlinking a provider is allowed
  const canUnlinkProvider = (providerId: string): boolean => {
    // Can unlink if user has password OR has another SSO linked
    const otherSsoAccounts = linkedAccounts.filter(a => 
      a.providerId !== providerId && a.providerId !== 'credential'
    )
    return hasPassword === true || otherSsoAccounts.length > 0
  }

  // Get provider display name
  const getProviderDisplayName = (providerId: string): string => {
    if (providerId === 'oidc') {
      return typeof (availableProviders as any).oidcName === 'string' ? (availableProviders as any).oidcName : 'OpenID'
    }
    const names: Record<string, string> = {
      'credential': 'Email & Password',
      'google': 'Google',
      'github': 'GitHub',
      'discord': 'Discord'
    }
    return names[providerId] || providerId
  }

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between py-6 gap-4 border-b border-white/5 last:border-0">
      <div className="flex-1 pr-4">
        <h3 className="text-lg font-medium text-white mb-1">Linked Accounts</h3>
        <p className="text-sm text-zinc-400">Sign-in methods connected to your account</p>
      </div>
      <div className="flex items-center gap-2 flex-wrap justify-end">
        {/* Email & Password badge */}
        {hasPassword && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20">
            <Check className="w-3 h-3" />
            Email
          </span>
        )}
        
        {/* Linked SSO accounts with unlink button */}
        {linkedAccounts.filter(a => a.providerId !== 'credential').map(acc => (
          <div 
            key={acc.providerId} 
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20"
          >
            <Check className="w-3 h-3" />
            <span>{getProviderDisplayName(acc.providerId)}</span>
            {/* Unlink button - always visible if unlinking is allowed */}
            {canUnlinkProvider(acc.providerId) && (
              <button
                onClick={() => onUnlink(acc.providerId)}
                disabled={unlinkingProvider === acc.providerId}
                className="ml-1.5 w-4 h-4 flex items-center justify-center rounded-full bg-red-500/20 text-red-400 hover:bg-red-500/40 hover:text-red-300 transition-all disabled:opacity-50"
                title={`Unlink ${getProviderDisplayName(acc.providerId)}`}
              >
                {unlinkingProvider === acc.providerId ? (
                  <span className="w-2 h-2 border border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span className="text-xs font-bold leading-none">×</span>
                )}
              </button>
            )}
          </div>
        ))}
        
        {/* Available providers to link */}
        {(['google', 'github', 'discord', 'oidc'] as const)
          .filter(provider => availableProviders[provider] && !linkedAccounts.find(a => a.providerId === provider))
          .map(provider => (
            <button 
              key={provider}
              onClick={() => onLink(provider)}
              disabled={linkingProvider === provider}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-zinc-700/50 text-zinc-300 border border-white/10 hover:bg-zinc-600/50 hover:border-white/20 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Link className="w-3 h-3" />
              {linkingProvider === provider ? 'Linking...' : getProviderDisplayName(provider)}
            </button>
          ))}
      </div>
    </div>
  )
}
