import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { apiFetch } from '../lib/apiFetch'
import { createLogger } from '../utils/client-logger'

const log = createLogger('ExploreAddonsModel')

export interface AddonRecord {
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

const RECOMMENDED_ADDON_SEEDS = [
  { transportName: 'Comet',            transportUrl: 'https://comet.zentrio.eu/manifest.json' },
  { transportName: 'Torz',             transportUrl: 'https://stremthru.zentrio.eu/stremio/torz/manifest.json' },
  { transportName: 'OpenSubtitles v3', transportUrl: 'https://opensubtitles-v3.strem.io/manifest.json' },
  { transportName: 'SubDL',            transportUrl: 'https://subdl.strem.top/manifest.json' },
]

export interface ExploreAddonsScreenModel {
  status: 'loading' | 'ready' | 'error'
  errorMessage?: string
  searchQuery: string
  selectedCategory: string
  categories: string[]
  recommendedAddons: AddonRecord[]
  filteredAddons: AddonRecord[]
  installedAddons: InstalledAddon[]
  processingAddonId: string | null
  navigation: {
    goBack: () => void
  }
  actions: {
    retry: () => Promise<void>
    setSearchQuery: (value: string) => void
    setSelectedCategory: (value: string) => void
    clearFilters: () => void
    installAddon: (addon: AddonRecord) => Promise<void>
    uninstallAddon: (addonId: string) => Promise<void>
    configureAddon: (addon: AddonRecord) => void
  }
}

export function useExploreAddonsScreenModel(): ExploreAddonsScreenModel {
  const navigate = useNavigate()
  const [addons, setAddons] = useState<AddonRecord[]>([])
  const [recommendedAddons, setRecommendedAddons] = useState<AddonRecord[]>([])
  const [installedAddons, setInstalledAddons] = useState<InstalledAddon[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [activeProfileId, setActiveProfileId] = useState('')
  const [processingAddonId, setProcessingAddonId] = useState<string | null>(null)

  const categories = useMemo(() => {
    const allTypes = new Set<string>(['all'])
    addons.forEach((addon) => {
      addon.manifest.types.forEach((type) => allTypes.add(type))
    })
    return Array.from(allTypes)
  }, [addons])

  const initialize = async () => {
    setStatus('loading')
    setErrorMessage('')
    try {
      const addonsPromise = fetch('https://api.strem.io/addonscollection.json').then((response) => response.json())
      const recommendedPromise = Promise.all(
        RECOMMENDED_ADDON_SEEDS.map(async (seed) => {
          try {
            const res = await fetch(seed.transportUrl)
            if (!res.ok) return null
            const manifest = await res.json()
            return { transportName: seed.transportName, transportUrl: seed.transportUrl, manifest } as AddonRecord
          } catch {
            return null
          }
        })
      ).then((results) => results.filter(Boolean) as AddonRecord[])

      const profilesResponse = await apiFetch('/api/user/settings-profiles')
      let profileId = ''
      if (profilesResponse.ok) {
        const data = await profilesResponse.json()
        const profiles = data.data || data || []
        if (profiles.length > 0) {
          const lastUsed = localStorage.getItem('lastSelectedAddonProfile')
          const found = profiles.find((profile: any) => String(profile.id) === lastUsed)
          profileId = String(found ? found.id : profiles[0].id)
        }
      }

      setActiveProfileId(profileId)

      let installed: InstalledAddon[] = []
      if (profileId) {
        const installedResponse = await apiFetch(`/api/addons/settings-profile/${profileId}/manage`)
        if (installedResponse.ok) {
          installed = await installedResponse.json()
        }
      }

      const [addonsData, recommended] = await Promise.all([addonsPromise, recommendedPromise])
      setAddons(addonsData)
      setRecommendedAddons(recommended)
      setInstalledAddons(installed)
      setStatus('ready')
    } catch (error) {
      log.error('initialize addons error', error)
      setErrorMessage('Failed to load addons')
      setStatus('error')
    }
  }

  useEffect(() => {
    void initialize()
  }, [])

  const reloadInstalled = async () => {
    if (!activeProfileId) return
    try {
      const response = await apiFetch(`/api/addons/settings-profile/${activeProfileId}/manage`)
      if (response.ok) {
        setInstalledAddons(await response.json())
      }
    } catch (error) {
      log.error('reload installed error', error)
    }
  }

  const installAddon = async (addon: AddonRecord) => {
    if (!activeProfileId) {
      toast.error('No settings profile selected')
      return
    }

    setProcessingAddonId(addon.transportUrl)
    try {
      const response = await apiFetch('/api/addons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          manifestUrl: addon.transportUrl,
          settingsProfileId: activeProfileId,
        }),
      })

      if (!response.ok) {
        const body = await response.json()
        throw new Error(body.error || 'Failed to install addon')
      }

      toast.success(`${addon.manifest.name} installed`)
      await reloadInstalled()
    } catch (error) {
      log.error('install addon error', error)
      toast.error(error instanceof Error ? error.message : 'Failed to install addon')
    } finally {
      setProcessingAddonId(null)
    }
  }

  const uninstallAddon = async (addonId: string) => {
    if (!activeProfileId) return
    setProcessingAddonId(addonId)
    try {
      const response = await apiFetch(`/api/addons/settings-profile/${activeProfileId}/${addonId}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        throw new Error('Failed to uninstall addon')
      }

      toast.success('Addon uninstalled')
      await reloadInstalled()
    } catch (error) {
      log.error('uninstall addon error', error)
      toast.error(error instanceof Error ? error.message : 'Failed to uninstall addon')
    } finally {
      setProcessingAddonId(null)
    }
  }

  const configureAddon = (addon: AddonRecord) => {
    let configUrl = addon.transportUrl.replace('/manifest.json', '')
    if (configUrl.endsWith('/')) {
      configUrl = configUrl.slice(0, -1)
    }
    configUrl += '/configure'
    window.open(configUrl, '_blank')
  }

  const filteredAddons = useMemo(() => {
    return addons.filter((addon) => {
      const matchesSearch =
        addon.manifest.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        addon.manifest.description.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesCategory = selectedCategory === 'all' || addon.manifest.types.includes(selectedCategory)
      return matchesSearch && matchesCategory
    })
  }, [addons, searchQuery, selectedCategory])

  return {
    status,
    errorMessage: errorMessage || undefined,
    searchQuery,
    selectedCategory,
    categories,
    recommendedAddons,
    filteredAddons,
    installedAddons,
    processingAddonId,
    navigation: {
      goBack: () => navigate('/settings'),
    },
    actions: {
      retry: initialize,
      setSearchQuery,
      setSelectedCategory,
      clearFilters: () => {
        setSearchQuery('')
        setSelectedCategory('all')
      },
      installAddon,
      uninstallAddon,
      configureAddon,
    },
  }
}
