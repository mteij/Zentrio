import { ArrowLeft, ChevronDown, ChevronUp, Film, GripVertical, Tv } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { AnimatedBackground, Button, LoadingSpinner, SimpleLayout } from '../components'
import { Toggle } from '../components'
import { ZENTRIO_LOGO_192_URL } from '../lib/brand-assets'
import { apiFetch } from '../lib/apiFetch'
import settingsStyles from '../styles/Settings.module.css'
import styles from '../styles/TmdbAddonConfig.module.css'

interface CatalogEntry {
  id: string
  type: 'movie' | 'series'
  enabled: boolean
  showOnHome: boolean
}

const CATALOG_LABELS: Record<string, string> = {
  'tmdb.new': 'Latest Releases',
  'tmdb.trending': 'Trending',
  'tmdb.top': 'Popular',
  'tmdb.year': 'Year',
  'tmdb.language': 'Language',
}

function makeKey(e: CatalogEntry) {
  return `${e.id}-${e.type}`
}

interface CatalogSectionProps {
  entries: CatalogEntry[]
  onReorder: (newEntries: CatalogEntry[]) => void
  onToggle: (id: string, type: 'movie' | 'series', field: 'enabled' | 'showOnHome', value: boolean) => void
}

function CatalogSection({ entries, onReorder, onToggle }: CatalogSectionProps) {
  const [draggedKey, setDraggedKey] = useState<string | null>(null)
  const [dragOverKey, setDragOverKey] = useState<string | null>(null)

  const move = (key: string, direction: 'up' | 'down') => {
    const index = entries.findIndex(e => makeKey(e) === key)
    if (index === -1) return
    const newIndex = direction === 'up' ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= entries.length) return
    const next = [...entries]
    const [item] = next.splice(index, 1)
    next.splice(newIndex, 0, item)
    onReorder(next)
  }

  const handleDragStart = (e: React.DragEvent, key: string) => {
    setDraggedKey(key)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent, key: string) => {
    e.preventDefault()
    if (draggedKey !== key) setDragOverKey(key)
  }

  const handleDrop = (e: React.DragEvent, targetKey: string) => {
    e.preventDefault()
    if (!draggedKey || draggedKey === targetKey) {
      setDraggedKey(null)
      setDragOverKey(null)
      return
    }
    const fromIdx = entries.findIndex(e => makeKey(e) === draggedKey)
    const toIdx = entries.findIndex(e => makeKey(e) === targetKey)
    if (fromIdx === -1 || toIdx === -1) return
    const next = [...entries]
    const [item] = next.splice(fromIdx, 1)
    next.splice(toIdx, 0, item)
    onReorder(next)
    setDraggedKey(null)
    setDragOverKey(null)
  }

  return (
    <div className={styles.catalogList}>
      {entries.map((entry, index) => {
        const key = makeKey(entry)
        return (
          <div
            key={key}
            className={`${styles.catalogRow} ${dragOverKey === key ? styles.catalogRowDragOver : ''} ${draggedKey === key ? styles.catalogRowDragging : ''}`}
            draggable
            onDragStart={e => handleDragStart(e, key)}
            onDragOver={e => handleDragOver(e, key)}
            onDragLeave={() => setDragOverKey(null)}
            onDrop={e => handleDrop(e, key)}
            onDragEnd={() => { setDraggedKey(null); setDragOverKey(null) }}
          >
            {/* Drag handle + arrows */}
            <div className={styles.reorderControls}>
              <GripVertical size={16} className={styles.dragHandle} />
              <div className={styles.arrowButtons}>
                <button
                  className={styles.arrowBtn}
                  onClick={() => move(key, 'up')}
                  disabled={index === 0}
                  title="Move up"
                >
                  <ChevronUp size={14} />
                </button>
                <button
                  className={styles.arrowBtn}
                  onClick={() => move(key, 'down')}
                  disabled={index === entries.length - 1}
                  title="Move down"
                >
                  <ChevronDown size={14} />
                </button>
              </div>
            </div>

            {/* Catalog name */}
            <div className={styles.catalogInfo}>
              <span className={styles.catalogName}>{CATALOG_LABELS[entry.id] ?? entry.id}</span>
            </div>

            {/* Toggles */}
            <div className={styles.catalogToggles}>
              <div className={styles.toggleCell}>
                <Toggle
                  checked={entry.enabled}
                  onChange={v => onToggle(entry.id, entry.type, 'enabled', v)}
                />
              </div>
              <div className={styles.toggleCell}>
                <Toggle
                  checked={entry.showOnHome}
                  onChange={v => onToggle(entry.id, entry.type, 'showOnHome', v)}
                  disabled={!entry.enabled}
                />
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function TmdbAddonConfigPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
  const settingsProfileId = searchParams.get('profileId')

  // Keep movies and series as separate ordered lists
  const [movies, setMovies] = useState<CatalogEntry[]>([])
  const [series, setSeries] = useState<CatalogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!settingsProfileId) return
    loadConfig()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsProfileId])

  const loadConfig = async () => {
    setLoading(true)
    try {
      const res = await apiFetch(`/api/addons/tmdb-config/${settingsProfileId}`)
      if (res.ok) {
        const entries: CatalogEntry[] = await res.json()
        setMovies(entries.filter(e => e.type === 'movie'))
        setSeries(entries.filter(e => e.type === 'series'))
      }
    } catch {
      toast.error('Failed to load catalog configuration')
    } finally {
      setLoading(false)
    }
  }

  const updateEntry = (
    setList: React.Dispatch<React.SetStateAction<CatalogEntry[]>>,
    id: string,
    type: 'movie' | 'series',
    field: 'enabled' | 'showOnHome',
    value: boolean
  ) => {
    setList(prev => prev.map(e => e.id === id && e.type === type ? { ...e, [field]: value } : e))
  }

  const handleSave = async () => {
    if (!settingsProfileId) return
    setSaving(true)
    try {
      const config = [...movies, ...series]
      const res = await apiFetch(`/api/addons/tmdb-config/${settingsProfileId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      if (res.ok) {
        toast.success('Catalog configuration saved')
        // Bust the dashboard cache so home page reflects the new config immediately
        await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
        navigate(-1)
      } else {
        toast.error('Failed to save configuration')
      }
    } catch {
      toast.error('Failed to save configuration')
    } finally {
      setSaving(false)
    }
  }

  return (
    <SimpleLayout title="TMDB Catalog Configuration">
      <AnimatedBackground />

      <button className={settingsStyles.backBtn} onClick={() => navigate(-1)}>
        <ArrowLeft size={18} />
        Back
      </button>

      <div className={styles.configPage}>
        <div className={styles.configContainer}>

          {/* Header */}
          <header className={styles.header}>
            <div className={styles.headerLogo}>
              <img src={ZENTRIO_LOGO_192_URL} alt="Zentrio" />
            </div>
            <div className={styles.headerInfo}>
              <h1 className={styles.headerTitle}>Catalog Configuration</h1>
              <p className={styles.headerDescription}>
                Manage and reorder the catalogs for the native Zentrio TMDB integration.
              </p>
            </div>
          </header>

          {loading ? (
            <div className={styles.loadingState}>
              <LoadingSpinner size="md" />
            </div>
          ) : (
            <>
              {/* Column headers */}
              <div className={styles.tableHeader}>
                <span className={styles.tableHeaderSpacer} />
                <span className={styles.tableHeaderCatalog}>Catalog</span>
                <span className={styles.tableHeaderToggle}>Enable</span>
                <span className={styles.tableHeaderToggle}>Home</span>
              </div>

              {/* Movies section */}
              <section className={styles.section}>
                <div className={styles.sectionHeader}>
                  <Film size={18} className={styles.sectionIcon} />
                  <h2 className={styles.sectionTitle}>Movies</h2>
                </div>
                <CatalogSection
                  entries={movies}
                  onReorder={setMovies}
                  onToggle={(id, type, field, value) =>
                    updateEntry(setMovies, id, type, field, value)
                  }
                />
              </section>

              {/* TV Shows section */}
              <section className={styles.section}>
                <div className={styles.sectionHeader}>
                  <Tv size={18} className={styles.sectionIcon} />
                  <h2 className={styles.sectionTitle}>TV Shows</h2>
                </div>
                <CatalogSection
                  entries={series}
                  onReorder={setSeries}
                  onToggle={(id, type, field, value) =>
                    updateEntry(setSeries, id, type, field, value)
                  }
                />
              </section>

              {/* Save button */}
              <div className={styles.actions}>
                <Button variant="secondary" onClick={() => navigate(-1)}>Cancel</Button>
                <Button variant="primary" onClick={handleSave} disabled={saving}>
                  {saving ? <LoadingSpinner size="sm" /> : 'Save Changes'}
                </Button>
              </div>
            </>
          )}

        </div>
      </div>
    </SimpleLayout>
  )
}
