import { useState, useEffect } from 'react'
import { LoginBehavior } from '../../hooks/useLoginBehavior'
import { useSessionDuration, SessionDuration } from '../../hooks/useSessionDuration'

interface Profile {
  id: number
  name: string
  avatar: string
  avatar_style?: string
}

export function LoginBehaviorSettings() {
  const [behavior, setBehavior] = useState<LoginBehavior>('profiles')
  const [specificProfileId, setSpecificProfileId] = useState<string>('')
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const { duration, setDuration } = useSessionDuration()

  useEffect(() => {
    // Load current settings from localStorage
    const savedBehavior = localStorage.getItem('zentrioLoginBehavior') as LoginBehavior
    const savedProfileId = localStorage.getItem('zentrioLoginBehaviorProfileId')
    
    if (savedBehavior) {
      setBehavior(savedBehavior)
    }
    if (savedProfileId) {
      setSpecificProfileId(savedProfileId)
    }

    // Load profiles for the dropdown
    loadProfiles()
  }, [])

  const loadProfiles = async () => {
    try {
      const res = await fetch('/api/profiles')
      if (res.ok) {
        const data = await res.json()
        setProfiles(data)
      }
    } catch (e) {
      console.error('Failed to load profiles:', e)
    } finally {
      setLoading(false)
    }
  }

  const handleBehaviorChange = (newBehavior: LoginBehavior) => {
    setBehavior(newBehavior)
    localStorage.setItem('zentrioLoginBehavior', newBehavior)
  }

  const handleProfileChange = (profileId: string) => {
    setSpecificProfileId(profileId)
    localStorage.setItem('zentrioLoginBehaviorProfileId', profileId)
  }

  return (
    <>
      {/* Login Behavior Setting */}
      <div className="flex flex-col md:flex-row md:items-center justify-between py-6 gap-4 border-b border-white/5">
        <div className="flex-1 pr-4">
          <h3 className="text-lg font-medium text-white mb-1">Login Behavior</h3>
          <p className="text-sm text-zinc-400">Choose what happens when you log in to this device</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <select
            value={behavior}
            onChange={(e) => handleBehaviorChange(e.target.value as LoginBehavior)}
            className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-red-500 transition-colors min-w-[180px]"
          >
            <option value="profiles">Show profile selection</option>
            <option value="last">Open last used profile</option>
            <option value="specific">Open a specific profile</option>
          </select>
          
          {behavior === 'specific' && (
            <select
              value={specificProfileId}
              onChange={(e) => handleProfileChange(e.target.value)}
              disabled={loading || profiles.length === 0}
              className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-red-500 transition-colors min-w-[140px] disabled:opacity-50"
            >
              <option value="">Select profile</option>
              {profiles.map(profile => (
                <option key={profile.id} value={profile.id}>
                  {profile.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Session Duration Setting */}
      <div className="flex flex-col md:flex-row md:items-center justify-between py-6 gap-4 border-b border-white/5 last:border-0">
        <div className="flex-1 pr-4">
          <h3 className="text-lg font-medium text-white mb-1">Session Duration</h3>
          <p className="text-sm text-zinc-400">How long should you stay logged in on this device?</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <select
            value={duration}
            onChange={(e) => setDuration(e.target.value as SessionDuration)}
            className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-red-500 transition-colors min-w-[180px]"
          >
            <option value="indefinite">Keep me logged in</option>
            <option value="session">This browser session only</option>
          </select>
        </div>
      </div>
    </>
  )
}
