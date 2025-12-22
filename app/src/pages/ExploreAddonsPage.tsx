import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Search, Filter, ArrowLeft, Download, Star, Settings, Trash2, Check, X } from 'lucide-react'
import { SimpleLayout, Button, LoadingSpinner, AnimatedBackground } from '../components'
import styles from '../styles/Addons.module.css'
import settingsStyles from '../styles/Settings.module.css'

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
            version: "2.0.0",
            description: "Stremio's fastest torrent/debrid search add-on.",
            logo: "https://i.imgur.com/jmVoVMu.jpeg",
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
            name: "StremThru Torz",
            version: "0.94.5",
            description: "Stremio Addon to access crowdsourced Torz.",
            logo: "https://emojiapi.dev/api/v1/sparkles/256.png",
            types: ["movie", "series"]
        }
    },
    {
        transportName: "OpenSubtitles v3",
        transportUrl: "https://opensubtitles-v3.strem.io/manifest.json",
        manifest: {
            id: "org.stremio.opensubtitles-v3",
            name: "OpenSubtitles v3",
            version: "1.0.0",
            description: "OpenSubtitles v3 Addon for Stremio",
            logo: "https://www.strem.io/images/addons/opensubtitles-logo.png",
            types: ["movie", "series"]
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
    
    const installed = installedAddons.find(a => a.id === addon.manifest.id || a.manifest_url === addon.transportUrl);
    const isProcessing = processingAddonId === addon.transportUrl || (installed && processingAddonId === installed.id);

    const cardClasses = [
        styles.addonCard,
        isRecommended && styles.addonCardRecommended,
        installed && styles.addonCardInstalled
    ].filter(Boolean).join(' ');

    return (
      <div className={cardClasses}>
          {/* Header: Logo + Info */}
          <div className={styles.cardHeader}>
              <div className={styles.cardLogo}>
                  {addon.manifest.logo && !imgError ? (
                      <img 
                        src={addon.manifest.logo} 
                        alt={addon.manifest.name} 
                        onError={() => setImgError(true)}
                      />
                  ) : (
                      <span className={styles.cardLogoPlaceholder}>
                        {addon.manifest.name.substring(0, 2)}
                      </span>
                  )}
              </div>
              <div className={styles.cardInfo}>
                  <div className={styles.cardTitleRow}>
                      <h3 className={styles.cardTitle} title={addon.manifest.name}>
                        {addon.manifest.name}
                      </h3>
                      {isRecommended && <Star size={14} className={styles.starIcon} fill="currentColor" />}
                      {installed && <Check size={14} className={styles.installedIcon} />}
                  </div>
                  <div className={styles.cardMeta}>
                      <span className={styles.versionBadge}>v{addon.manifest.version}</span>
                      {addon.manifest.types.slice(0, 2).map(t => (
                          <span key={t} className={styles.typeBadge}>{t}</span>
                      ))}
                  </div>
              </div>
          </div>
          
          {/* Description */}
          <p className={styles.cardDescription}>
              {addon.manifest.description}
          </p>
          
          {/* Actions */}
          <div className={styles.cardActions}>
              {installed ? (
                  <>
                      <button 
                          className={styles.btnConfig}
                          onClick={() => onConfigure(addon)}
                      >
                          <Settings size={16} />
                          Configure
                      </button>
                      <button 
                          className={styles.btnUninstall}
                          onClick={() => onUninstall(installed.id)}
                          disabled={!!isProcessing}
                          title="Uninstall"
                      >
                          {isProcessing ? <LoadingSpinner size="sm" /> : <Trash2 size={16} />}
                      </button>
                  </>
              ) : (
                  <button 
                      className={`${styles.btnInstall} ${isRecommended ? styles.btnInstallPrimary : ''}`}
                      onClick={() => onInstall(addon)}
                      disabled={!!isProcessing}
                  >
                      {isProcessing ? (
                          <LoadingSpinner size="sm" />
                      ) : (
                          <>
                              <Download size={16} />
                              Install
                          </>
                      )}
                  </button>
              )}
          </div>
      </div>
    );
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
    setProcessingAddonId(addon.transportUrl);
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
      
      {/* Back Button */}
      <button
        className={settingsStyles.backBtn}
        onClick={() => navigate('/settings')}
      >
        <ArrowLeft size={18} />
        Back to Settings
      </button>

      <div className={styles.addonsPage}>
        <div className={styles.addonsContainer}>
          
          {/* Header Section */}
          <header className={styles.header}>
            <div className={styles.headerTop}>
              <div className={styles.headerInfo}>
                <h1 className={styles.headerTitle}>Community Addons</h1>
                <p className={styles.headerDescription}>
                  Discover and install community-created addons to expand your library with new content sources and features.
                </p>
              </div>
            </div>

            {/* Search & Filter */}
            <div className={styles.searchFilterBar}>
              <div className={styles.searchWrapper}>
                <Search size={18} className={styles.searchIcon} />
                <input 
                  type="text"
                  placeholder="Search addons..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={styles.searchInput}
                />
              </div>
              
              <div className={styles.filterWrapper}>
                <Filter size={18} className={styles.filterIcon} />
                <select 
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className={styles.filterSelect}
                >
                  <option value="all">All Categories</option>
                  {categories.filter(c => c !== 'all').map(category => (
                      <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>
            </div>
          </header>

          {/* Recommended Section */}
          <section>
            <div className={styles.sectionHeader}>
              <Star size={20} className={styles.sectionIcon} />
              <h2 className={styles.sectionTitle}>Recommended</h2>
            </div>
            <div className={styles.addonsGrid}>
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
          </section>

          {/* All Addons Section */}
          <section>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>All Addons</h2>
            </div>

            {loading ? (
                <div className={styles.loadingContainer}>
                    <LoadingSpinner fullScreen={false} />
                </div>
            ) : filteredAddons.length > 0 ? (
                <div className={styles.addonsGrid}>
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
                <div className={styles.emptyState}>
                    <p>No addons found matching your criteria.</p>
                    <Button 
                        variant="secondary" 
                        onClick={() => {
                            setSearchQuery('')
                            setSelectedCategory('all')
                        }}
                    >
                        Clear Filters
                    </Button>
                </div>
            )}
          </section>
          
        </div>
      </div>

    </SimpleLayout>
  );
}