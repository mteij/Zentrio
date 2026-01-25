// TMDB Settings Component
// Extracted from SettingsPage.tsx
import { useState } from 'react'
import { Check } from 'lucide-react'
import { Button, Input } from '../../components'

interface TmdbSettingsProps {
  apiKey: string
  isConfigured: boolean
  onUpdate: (clearKey?: boolean, keyValue?: string) => Promise<void>
}

export function TmdbSettings({ apiKey, isConfigured, onUpdate }: TmdbSettingsProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [keyInput, setKeyInput] = useState('')

  const handleSave = async () => {
    await onUpdate(false, keyInput)
    setIsEditing(false)
  }

  const handleRemove = async () => {
    await onUpdate(true)
    setIsEditing(false)
  }

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between py-6 gap-4 border-b border-white/5 last:border-0">
      <div className="flex-1 pr-8">
        <h3 className="text-lg font-medium text-white mb-1">TMDB API Key (Optional)</h3>
        <p className="text-sm text-zinc-400 max-w-xl">
          Zentrio uses a shared API key by default. Add your own key only if you experience rate limiting.{' '}
          <a 
            href="https://www.themoviedb.org/settings/api" 
            target="_blank" 
            rel="noopener noreferrer"
            className="underline hover:opacity-80 transition-opacity"
            style={{ color: 'var(--theme-color)' }}
          >
            Get a free key here
          </a>
        </p>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {!isEditing ? (
          <>
            {isConfigured ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20">
                <Check className="w-3 h-3" />
                Personal key configured
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-zinc-700/50 text-zinc-300 border border-white/10">
                Using shared key
              </span>
            )}
            <Button 
              variant="secondary" 
              onClick={() => {
                setKeyInput(apiKey)
                setIsEditing(true)
              }}
            >
              {isConfigured ? 'Edit' : 'Add Key'}
            </Button>
          </>
        ) : (
          <div className="flex gap-2 items-center">
            <Input
              type="password"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder="Enter TMDB API Key"
              className="!w-48 md:!w-64 !bg-zinc-900 !border !border-zinc-700 !rounded-lg !px-3 !py-2 !text-white focus:outline-none focus:border-red-500 transition-colors"
              autoFocus
            />
            <Button 
              variant="primary" 
              onClick={handleSave}
            >
              Save
            </Button>
            {isConfigured && (
              <Button 
                variant="secondary" 
                onClick={handleRemove}
              >
                Remove
              </Button>
            )}
            <Button 
              variant="secondary" 
              onClick={() => setIsEditing(false)}
            >
              Cancel
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
