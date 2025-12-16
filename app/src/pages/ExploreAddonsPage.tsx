import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { SimpleLayout, Button, LoadingSpinner, AnimatedBackground } from '../components'
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

export function ExploreAddonsPage() {
  const navigate = useNavigate()
  const [addons, setAddons] = useState<Addon[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadAddons()
  }, [])

  const loadAddons = async () => {
    setLoading(true)
    try {
      const response = await fetch('https://api.strem.io/addonscollection.json');
      if (!response.ok) {
        throw new Error('Failed to fetch addons');
      }
      const addonsData = await response.json();
      setAddons(addonsData);
    } catch (err) {
      console.error(err)
      setError('Failed to load addons')
    } finally {
      setLoading(false)
    }
  }

  const installAddon = async (manifestUrl: string) => {
    try {
        const res = await fetch('/api/addons', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ manifestUrl })
        })
        if (res.ok) {
            toast.success('Success', { description: 'Addon installed successfully!' })
        } else {
            toast.error('Installation Failed', { description: 'Failed to install addon' })
        }
    } catch (e) {
        console.error(e)
        toast.error('Installation Error', { description: 'Error installing addon' })
    }
  }

  return (
    <SimpleLayout title="Explore Addons">
      <AnimatedBackground />
      <div className={`${styles.container} relative z-[1]`}>
        <div className="pt-20">
          <button
            id="backButton"
            className={styles.backBtn}
            onClick={() => navigate('/settings')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
            </svg>
            Back to Settings
          </button>
          <div className={styles.settingsCard}>
            <h2 className={styles.sectionTitle}>Explore Addons</h2>
            
            {loading ? (
                <LoadingSpinner fullScreen={false} />
            ) : (
                <div id="exploreAddonsList" className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-5">
                {addons.map((addon, idx) => (
                    <div key={idx} className="bg-white/5 p-5 rounded-lg flex flex-col gap-2.5">
                        <div className="flex items-center gap-4">
                            <img src={addon.manifest.logo} alt={addon.manifest.name} className="w-12 h-12 object-contain" />
                            <div>
                                <h3 className="m-0 text-lg">{addon.manifest.name}</h3>
                                <span className="text-xs text-zinc-400">v{addon.manifest.version}</span>
                            </div>
                        </div>
                        <p className="text-sm text-zinc-300 flex-1">{addon.manifest.description}</p>
                        <Button variant="primary" onClick={() => installAddon(addon.transportUrl)}>Install</Button>
                    </div>
                ))}
                </div>
            )}
          </div>
        </div>
      </div>
    </SimpleLayout>
  );
}