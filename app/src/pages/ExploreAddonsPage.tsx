import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Search, Filter, ArrowLeft, Download, Star, Settings, Trash2, Check, X, Plus } from 'lucide-react'
import { SimpleLayout, Button, LoadingSpinner, AnimatedBackground, Input } from '../components'
import styles from '../styles/Settings.module.css'

interface Addon {
  manifest: {
    id: string
    name: string
    version: string
    description: string
    logo: string
    types: string[]
  }
  transportUrl: string
  transportName: string
}

interface InstalledAddon {
    id: string
    manifest_url: string
    enabled: boolean
}

// Recommended addons configuration
const RECOMMENDED_ADDONS: Addon[] = [
    {
        transportName: "Comet",
        transportUrl: "https://comet.elfhosted.com/manifest.json",
        manifest: {
            id: "org.stremio.comet",
            name: "Comet | Elfhosted",
            version: "1.0.0",
            description: "Comet is a Stremio addon that provides streams from various torrent trackers.",
            logo: "https://comet.elfhosted.com/static/logo.png",
            types: ["movie", "series"]
        }
    },
    {
        transportName: "TMDB",
        transportUrl: "https://94c8cb9f702d-tmdb-addon.baby-beamup.club/manifest.json",
        manifest: {
            id: "org.stremio.tmdb",
            name: "TMDB",
            version: "1.0.0",
            description: "The Movie Database addon for metadata.",
            logo: "https://www.themoviedb.org/assets/2/v4/logos/v2/blue_square_2-d537fb228cf3ded904ef09b136fe3fec72548ebc1fea3fbbd1ad9e36364db38b.svg",
            types: ["movie", "series"]
        }
    },
    {
        transportName: "Torz",
        transportUrl: "https://stremthru.elfhosted.com/stremio/torz/manifest.json",
        manifest: {
            id: "org.stremio.torz",
            name: "Torz",
            version: "1.0.0",
            description: "Torrent search engine addon.",
            logo: "https://torz.app/logo.png", // Placeholder
            types: ["movie", "series"]
        }
    },
    {
        transportName: "OpenSubtitles v3",
        transportUrl: "https://opensubtitles-v3.strem.io/manifest.json",
        manifest: {
            id: "org.stremio.opensubtitles-v3",
            name: "OpenSubtitles v3",
            version: "3.0.0",
            description: "Official OpenSubtitles add-on for Stremio",
            logo: "https://opensubtitles-v3.strem.io/logo.png",
            types: ["other"]
        }
    }
];

interface AddonCardProps {
    addon: Addon
    isRecommended?: boolean
    installedAddons: InstalledAddon[]
    processingAddonId: string | null
    onInstall: (addon: Addon) => void
    onUninstall: (addonId: string) => void
    onConfigure: (addon: Addon) => void
}

const AddonCard = ({ 
    addon, 
    isRecommended = false, 
    installedAddons, 
    processingAddonId, 
    onInstall, 
    onUninstall, 
    onConfigure 
}: AddonCardProps) => {
    const [imgError, setImgError] = useState(false);
    
    // Check if installed
    // We match by ID or transportUrl somewhat loosely to catch duplicates or same-ids
    // But typically ID is unique. Using ID from manifest.
    const installed = installedAddons.find(a => a.id === addon.manifest.id || a.manifest_url === addon.transportUrl);
    const isProcessing = processingAddonId === addon.transportUrl || (installed && processingAddonId === installed.id);

    return (
      <div className={`bg-white/5 p-5 rounded-lg flex flex-col gap-3 border border-white/5 hover:border-white/10 transition-colors ${isRecommended ? 'bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border-indigo-500/20' : ''}`}>
          <div className="flex items-start gap-4">
              <div className="w-14 h-14 bg-zinc-900 rounded-lg p-2 flex items-center justify-center shrink-0 border border-white/5">
                  {addon.manifest.logo && !imgError ? (
                      <img 
                        src={addon.manifest.logo} 
                        alt={addon.manifest.name} 
                        className="w-full h-full object-contain" 
                        onError={() => setImgError(true)}
                      />
                  ) : (
                      <div className="w-full h-full flex items-center justify-center bg-zinc-800 rounded">
                        <span className="text-xs text-zinc-500 uppercase font-bold">{addon.manifest.name.substring(0, 2)}</span>
                      </div>
                  )}
              </div>
              <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                      <h3 className="m-0 text-lg font-medium text-white truncate" title={addon.manifest.name}>{addon.manifest.name}</h3>
                      {isRecommended && <Star size={14} className="text-yellow-500 fill-yellow-500 shrink-0" />}
                      {installed && <Check size={14} className="text-green-500 shrink-0" />}
                  </div>
                  <div className="flex flex-wrap gap-2">
                      <span className="text-xs px-2 py-0.5 bg-white/10 rounded-full text-zinc-300">v{addon.manifest.version}</span>
                      {addon.manifest.types.slice(0, 2).map(t => (
                          <span key={t} className="text-xs px-2 py-0.5 bg-white/5 rounded-full text-zinc-400 capitalize">{t}</span>
                      ))}
                  </div>
              </div>
          </div>
          
          <p className="text-sm text-zinc-400 flex-1 line-clamp-3 leading-relaxed">
              {addon.manifest.description}
          </p>
          
          <div className="flex gap-2 mt-2">
              {installed ? (
                  <>
                      <Button 
                          variant="secondary" 
                          className="flex-1 justify-center"
                          onClick={() => onConfigure(addon)}
                      >
                          <Settings size={16} className="mr-2" />
                          Config
                      </Button>
                      <Button 
                          variant="danger" 
                          className="w-10 px-0 justify-center shrink-0"
                          onClick={() => onUninstall(installed.id)}
                          disabled={!!isProcessing}
                          title="Uninstall"
                      >
                          {isProcessing ? <LoadingSpinner size="sm" /> : <Trash2 size={16} />}
                      </Button>
                  </>
              ) : (
                  <Button 
                      variant={isRecommended ? "primary" : "secondary"} 
                      onClick={() => onInstall(addon)}
                      className="w-full justify-center"
                      disabled={!!isProcessing}
                  >
                      {isProcessing ? (
                          <LoadingSpinner size="sm" />
                      ) : (
                          <>
                              <Download size={16} className="mr-2" />
                              Install
                          </>
                      )}
                  </Button>
              )}
          </div>
      </div>
    );
}

// Config/Install Modal Component
const AddonConfigModal = ({ 
    isOpen, 
    onClose, 
    profileId, 
    onSuccess 
}: { 
    isOpen: boolean
    onClose: () => void
    profileId: string
    onSuccess: () => void 
}) => {
    const [url, setUrl] = useState('')
    const [installing, setInstalling] = useState(false)

    if (!isOpen) return null

    const handleInstall = async () => {
        if (!url || !profileId) return
        setInstalling(true)
        try {
            const res = await fetch('/api/addons', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    manifestUrl: url,
                    settingsProfileId: profileId 
                })
            })
            if (res.ok) {
                toast.success('Success', { description: 'Addon installed successfully!' })
                setUrl('')
                onSuccess()
                onClose()
            } else {
                const err = await res.json()
                toast.error('Failed', { description: err.error || 'Failed to install addon' })
            }
        } catch (e) {
            console.error(e)
            toast.error('Error', { description: 'Network error installing addon' })
        } finally {
            setInstalling(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-zinc-900 border border-white/10 rounded-xl p-6 w-full max-w-lg shadow-2xl">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-white">Addon Configuration</h3>
                    <button onClick={onClose} className="text-zinc-400 hover:text-white">
                        <X size={20} />
                    </button>
                </div>
                
                <p className="text-zinc-400 mb-4 text-sm">
                    If you customized the addon in the new window, paste the installation link here to update or install it.
                </p>

                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-medium text-zinc-500 mb-1 uppercase">Manifest URL</label>
                        <Input 
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            placeholder="https://.../manifest.json"
                            className="w-full"
                        />
                    </div>
                </div>

                <div className="flex justify-end gap-3 mt-6">
                    <Button variant="secondary" onClick={onClose}>Cancel</Button>
                    <Button variant="primary" onClick={handleInstall} disabled={installing || !url}>
                        {installing ? <LoadingSpinner size="sm" /> : 'Install / Update'}
                    </Button>
                </div>
            </div>
        </div>
    )
}

export function ExploreAddonsPage() {
  const navigate = useNavigate()
  const [addons, setAddons] = useState<Addon[]>([])
  const [installedAddons, setInstalledAddons] = useState<InstalledAddon[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [activeProfileId, setActiveProfileId] = useState<string>('')
  const [processingAddonId, setProcessingAddonId] = useState<string | null>(null)
  
  // State for config modal
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false)

  // Derive categories from addons
  const categories = useMemo(() => {
    const allTypes = new Set<string>(['all'])
    addons.forEach(addon => {
        addon.manifest.types.forEach(type => allTypes.add(type))
    })
    return Array.from(allTypes)
  }, [addons])

  useEffect(() => {
    initialize()
  }, [])

  const initialize = async () => {
      setLoading(true)
      try {
          // 1. Fetch available addons
          const addonsPromise = fetch('https://api.strem.io/addonscollection.json').then(r => r.json());
          
          // 2. Fetch profiles to get the active one
          const profilesRes = await fetch('/api/user/settings-profiles');
          let profileId = '';
          if (profilesRes.ok) {
              const data = await profilesRes.json();
              const profiles = data.data || data || [];
              if (profiles.length > 0) {
                  // Try to find last used profile or default to first
                  const lastUsed = localStorage.getItem('lastSelectedAddonProfile');
                  const found = profiles.find((p: any) => String(p.id) === lastUsed);
                  profileId = String(found ? found.id : profiles[0].id);
              }
          }
          setActiveProfileId(profileId);

          // 3. Fetch installed addons for the profile
          let installed: InstalledAddon[] = [];
          if (profileId) {
              try {
                  const installedRes = await fetch(`/api/addons/settings-profile/${profileId}/manage`);
                  if (installedRes.ok) {
                      installed = await installedRes.json();
                  }
              } catch (e) {
                  console.error('Failed to fetch installed addons', e);
              }
          }

          const [addonsData] = await Promise.all([addonsPromise]);
          setAddons(addonsData);
          setInstalledAddons(installed);

      } catch (err) {
        console.error(err)
        setError('Failed to load addons')
      } finally {
        setLoading(false)
      }
  }

  const reloadInstalled = async () => {
      if (!activeProfileId) return;
      try {
          const res = await fetch(`/api/addons/settings-profile/${activeProfileId}/manage`);
          if (res.ok) {
              setInstalledAddons(await res.json());
          }
      } catch (e) {
          console.error(e);
      }
  }

  const installAddon = async (addon: Addon) => {
    if (!activeProfileId) {
        toast.error('Profile Error', { description: 'No settings profile selected' });
        return;
    }
    setProcessingAddonId(addon.transportUrl); // Use transportUrl as temp ID for loading state
    try {
        const res = await fetch('/api/addons', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                manifestUrl: addon.transportUrl,
                settingsProfileId: activeProfileId 
            })
        })
        if (res.ok) {
            toast.success('Success', { description: `${addon.manifest.name} installed!` })
            await reloadInstalled();
        } else {
            const err = await res.json();
            toast.error('Installation Failed', { description: err.error || 'Failed to install addon' })
        }
    } catch (e) {
        console.error(e)
        const errorMsg = e instanceof Error ? e.message : 'Error installing addon';
        toast.error('Installation Error', { description: errorMsg })
    } finally {
        setProcessingAddonId(null);
    }
  }

  const uninstallAddon = async (addonId: string) => {
      if (!activeProfileId) return;
      setProcessingAddonId(addonId);
      try {
          const res = await fetch(`/api/addons/settings-profile/${activeProfileId}/${addonId}`, {
              method: 'DELETE'
          });
          if (res.ok) {
              toast.success('Success', { description: 'Addon uninstalled' })
              await reloadInstalled();
          } else {
              toast.error('Error', { description: 'Failed to uninstall addon' })
          }
      } catch (e) {
          console.error(e);
          toast.error('Error', { description: 'Network error uninstalling addon' })
      } finally {
          setProcessingAddonId(null);
      }
  }

  const configureAddon = (addon: Addon) => {
      let configUrl = addon.transportUrl.replace('/manifest.json', '')
      if (configUrl.endsWith('/')) configUrl = configUrl.slice(0, -1)
      configUrl += '/configure'
      window.open(configUrl, '_blank')

      // Open the manual install modal for the user to paste the result
      setIsConfigModalOpen(true)
  }

  const filteredAddons = useMemo(() => {
      return addons.filter(addon => {
          const matchesSearch = 
            addon.manifest.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            addon.manifest.description.toLowerCase().includes(searchQuery.toLowerCase());
          const matchesCategory = selectedCategory === 'all' || addon.manifest.types.includes(selectedCategory);
          
          return matchesSearch && matchesCategory;
      });
  }, [addons, searchQuery, selectedCategory]);

  return (
    <SimpleLayout title="Explore Addons">
      <AnimatedBackground />
      <div className="w-full max-w-[1600px] mx-auto px-6 relative z-[1] pt-20">
          <button
            className={styles.backBtn}
            onClick={() => navigate('/settings')}
          >
            <ArrowLeft size={18} />
            Back to Settings
          </button>
          
          <div className="flex flex-col gap-8 pb-20">
            {/* Header section with search and filter */}
            <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center bg-zinc-900/50 p-6 rounded-xl border border-white/5 backdrop-blur-sm">
                <div>
                    <h1 className="text-2xl font-bold text-white mb-2">Community Addons</h1>
                    <p className="text-zinc-400">Discover and install community-created addons to expand your library.</p>
                </div>
                <Button 
                    variant="secondary"
                    onClick={() => setIsConfigModalOpen(true)}
                >
                    <Plus size={16} className="mr-2" />
                    Manually Add Addon
                </Button>
            </div>

            {/* Recommended Section */}
            <div className="space-y-4">
                <div className="flex items-center gap-2 px-1">
                    <Star className="text-yellow-500" size={20} />
                    <h2 className="text-xl font-semibold text-white">Recommended</h2>
                </div>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(350px,1fr))] gap-6">
                    {RECOMMENDED_ADDONS.map((addon, idx) => (
                        <AddonCard 
                            key={`rec-${idx}`} 
                            addon={addon} 
                            isRecommended={true}
                            installedAddons={installedAddons}
                            processingAddonId={processingAddonId}
                            onInstall={installAddon}
                            onUninstall={uninstallAddon}
                            onConfigure={configureAddon}
                        />
                    ))}
                </div>
            </div>

            {/* All Addons Section */}
            <div className="space-y-4">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4 border-b border-white/5 pb-4">
                    <h2 className="text-xl font-semibold text-white">All Addons</h2>
                    
                    <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                        <div className="relative w-full md:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                            <Input 
                                placeholder="Search addons..." 
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="!pl-9 !bg-zinc-800/50 !border-white/10 focus:!border-white/20"
                            />
                        </div>
                        
                        <div className="relative w-full md:w-48">
                            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
                            <select 
                                value={selectedCategory}
                                onChange={(e) => setSelectedCategory(e.target.value)}
                                className="w-full h-10 pl-9 pr-4 bg-zinc-800/50 border border-white/10 rounded-lg text-sm text-white appearance-none focus:outline-none focus:border-white/20 cursor-pointer"
                            >
                                <option value="all">All Categories</option>
                                {categories.filter(c => c !== 'all').map(category => (
                                    <option key={category} value={category} className="capitalize">{category}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div className="h-64 flex items-center justify-center">
                        <LoadingSpinner fullScreen={false} />
                    </div>
                ) : filteredAddons.length > 0 ? (
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(350px,1fr))] gap-6">
                        {filteredAddons.map((addon, idx) => (
                            <AddonCard 
                                key={idx} 
                                addon={addon} 
                                installedAddons={installedAddons}
                                processingAddonId={processingAddonId}
                                onInstall={installAddon}
                                onUninstall={uninstallAddon}
                                onConfigure={configureAddon}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="py-20 text-center text-zinc-500">
                        <p>No addons found matching your criteria.</p>
                        <Button 
                            variant="secondary" 
                            className="mt-4"
                            onClick={() => {
                                setSearchQuery('')
                                setSelectedCategory('all')
                            }}
                        >
                            Clear Filters
                        </Button>
                    </div>
                )}
            </div>
          </div>
          
          <AddonConfigModal 
            isOpen={isConfigModalOpen} 
            onClose={() => setIsConfigModalOpen(false)} 
            profileId={activeProfileId}
            onSuccess={reloadInstalled}
          />
      </div>
    </SimpleLayout>
  );
}