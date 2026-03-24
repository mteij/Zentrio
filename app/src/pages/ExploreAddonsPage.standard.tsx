import { ArrowLeft, Check, Download, Filter, Search, Settings, Star, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { AnimatedBackground, Button, LoadingSpinner, SimpleLayout, SkeletonAddonCard } from '../components'
import { apiFetch } from '../lib/apiFetch'
import styles from '../styles/Addons.module.css'
import settingsStyles from '../styles/Settings.module.css'
import { createLogger } from '../utils/client-logger'

const log = createLogger('ExploreAddons')

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

// Seed list — only transport info needed; manifests are fetched dynamically at runtime
const RECOMMENDED_ADDON_SEEDS = [
    { transportName: "Comet",            transportUrl: "https://comet.zentrio.eu/manifest.json" },
    { transportName: "Torz",             transportUrl: "https://stremthru.zentrio.eu/stremio/torz/manifest.json" },
    { transportName: "OpenSubtitles v3", transportUrl: "https://opensubtitles-v3.strem.io/manifest.json" },
    { transportName: "SubDL",            transportUrl: "https://subdl.strem.top/manifest.json" },
];

const PAGE_SIZE = 24;

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

    const isZentrioHosted = addon.transportUrl.includes('zentrio.eu');

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
                      {isZentrioHosted && (
                          <span className={styles.zentrioTag} title="Hosted by Zentrio">
                              ZENTRIO
                          </span>
                      )}
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



export function ExploreAddonsPageStandardView(_props: { model: import('./ExploreAddonsPage.model').ExploreAddonsScreenModel }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [addons, setAddons] = useState<Addon[]>([])
  const [recommendedAddons, setRecommendedAddons] = useState<Addon[]>([])
  const [installedAddons, setInstalledAddons] = useState<InstalledAddon[]>([])
  const [loading, setLoading] = useState(true)
  const [_error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [activeProfileId, setActiveProfileId] = useState<string>('')
  const [processingAddonId, setProcessingAddonId] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const sentinelRef = useRef<HTMLDivElement>(null)


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
          // 1. Fetch available addons + recommended manifests in parallel
          const addonsPromise = fetch('https://api.strem.io/addonscollection.json').then(r => r.json());
          const recommendedPromise = Promise.all(
              RECOMMENDED_ADDON_SEEDS.map(async seed => {
                  try {
                      const res = await fetch(seed.transportUrl);
                      if (!res.ok) return null;
                      const manifest = await res.json();
                      return { transportName: seed.transportName, transportUrl: seed.transportUrl, manifest } as Addon;
                  } catch {
                      return null;
                  }
              })
          ).then(results => results.filter(Boolean) as Addon[]);
          
          // 2. Fetch profiles to get the active one
          const profilesRes = await apiFetch('/api/user/settings-profiles');
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
                  const installedRes = await apiFetch(`/api/addons/settings-profile/${profileId}/manage`);
                  if (installedRes.ok) {
                      installed = await installedRes.json();
                  }
              } catch (e) {
                  log.error('Failed to fetch installed addons', e);
              }
          }

          const [addonsData, recommended] = await Promise.all([addonsPromise, recommendedPromise]);
          setAddons(addonsData);
          setRecommendedAddons(recommended);
          setInstalledAddons(installed);

      } catch (err) {
        log.error(err)
        setError('Failed to load addons')
      } finally {
        setLoading(false)
      }
  }

  const reloadInstalled = async () => {
      if (!activeProfileId) return;
      try {
          const res = await apiFetch(`/api/addons/settings-profile/${activeProfileId}/manage`);
          if (res.ok) {
              setInstalledAddons(await res.json());
          }
      } catch (e) {
          log.error(e);
      }
  }

  const installAddon = async (addon: Addon) => {
    if (!activeProfileId) {
        toast.error('Profile Error', { description: 'No settings profile selected' });
        return;
    }
    setProcessingAddonId(addon.transportUrl);
    try {
        const res = await apiFetch('/api/addons', {
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
        log.error(e)
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
          const res = await apiFetch(`/api/addons/settings-profile/${activeProfileId}/${addonId}`, {
              method: 'DELETE'
          });
          if (res.ok) {
              toast.success('Success', { description: 'Addon uninstalled' })
              await reloadInstalled();
          } else {
              toast.error('Error', { description: 'Failed to uninstall addon' })
          }
      } catch (e) {
          log.error(e);
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
      setPage(1);
      return addons.filter(addon => {
          const matchesSearch =
            addon.manifest.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            addon.manifest.description.toLowerCase().includes(searchQuery.toLowerCase());
          const matchesCategory = selectedCategory === 'all' || addon.manifest.types.includes(selectedCategory);
          return matchesSearch && matchesCategory;
      });
  }, [addons, searchQuery, selectedCategory]);

  const pagedAddons = filteredAddons.slice(0, page * PAGE_SIZE);
  const hasMore = pagedAddons.length < filteredAddons.length;

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting && hasMore) setPage(p => p + 1); },
      { rootMargin: '200px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore]);

  const backLabel = (location.state as any)?.fromLabel ?? 'Back to Settings';
  const handleBack = () => {
    if ((location.state as any)?.from) navigate((location.state as any).from);
    else navigate('/settings?tab=addons');
  };

  return (
    <SimpleLayout title="Explore Addons">
      <AnimatedBackground />

      {/* Back Button */}
      <button
        className={settingsStyles.backBtn}
        onClick={handleBack}
      >
        <ArrowLeft size={18} />
        {backLabel}
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
              {recommendedAddons.map((addon, idx) => (
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
                <div className={styles.addonsGrid}>
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <SkeletonAddonCard key={i} />
                    ))}
                </div>
            ) : filteredAddons.length > 0 ? (
                <>
                    <div className={styles.addonsGrid}>
                        {pagedAddons.map((addon, idx) => (
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
                    <div ref={sentinelRef} style={{ height: 1 }} />
                </>
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
export default ExploreAddonsPageStandardView
