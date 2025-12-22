import { useState, useEffect, useCallback, useRef } from 'react'

interface Subtitle {
  id: string
  start: number
  end: number
  text: string
}

interface SubtitleTrack {
  id: string
  label: string
  language: string
  url?: string
  subtitles: Subtitle[]
}

interface UseSubtitlesProps {
  videoRef: React.RefObject<HTMLVideoElement>
}

export function useSubtitles({ videoRef }: UseSubtitlesProps) {
  const [tracks, setTracks] = useState<SubtitleTrack[]>([])
  const [activeTrack, setActiveTrackState] = useState<string | null>(null)
  const [currentSubtitle, setCurrentSubtitle] = useState<string>('')
  const [isEnabled, setIsEnabled] = useState(true)
  const intervalRef = useRef<number | null>(null)

  // Parse VTT format
  const parseVTT = (content: string): Subtitle[] => {
    const subtitles: Subtitle[] = []
    const lines = content.split('\n')
    let i = 0
    let subtitleId = 0

    // Skip WEBVTT header
    while (i < lines.length && !lines[i].includes('-->')) {
      i++
    }

    while (i < lines.length) {
      const line = lines[i].trim()
      
      if (line.includes('-->')) {
        const [start, end] = line.split('-->').map(t => parseTimestamp(t.trim()))
        let text = ''
        i++
        
        while (i < lines.length && lines[i].trim() !== '') {
          text += (text ? '\n' : '') + lines[i].trim()
          i++
        }
        
        if (text) {
          subtitles.push({
            id: `sub-${subtitleId++}`,
            start,
            end,
            text: text.replace(/<[^>]*>/g, '') // Remove HTML tags
          })
        }
      }
      i++
    }

    return subtitles
  }

  // Parse SRT format
  const parseSRT = (content: string): Subtitle[] => {
    const subtitles: Subtitle[] = []
    const blocks = content.split(/\r?\n\r?\n/)

    for (const block of blocks) {
      const lines = block.split('\n').filter(l => l.trim())
      if (lines.length >= 3) {
        const timeLine = lines[1]
        if (timeLine.includes('-->')) {
          const [start, end] = timeLine.split('-->').map(t => parseTimestamp(t.trim().replace(',', '.')))
          const text = lines.slice(2).join('\n').replace(/<[^>]*>/g, '')
          
          subtitles.push({
            id: lines[0],
            start,
            end,
            text
          })
        }
      }
    }

    return subtitles
  }

  // Parse timestamp to seconds
  const parseTimestamp = (timestamp: string): number => {
    const parts = timestamp.split(':')
    if (parts.length === 3) {
      const [hours, minutes, seconds] = parts
      return parseFloat(hours) * 3600 + parseFloat(minutes) * 60 + parseFloat(seconds)
    } else if (parts.length === 2) {
      const [minutes, seconds] = parts
      return parseFloat(minutes) * 60 + parseFloat(seconds)
    }
    return 0
  }

  // Load subtitles from URL
  const loadSubtitles = useCallback(async (url: string, label: string = 'English', language: string = 'en') => {
    try {
      const response = await fetch(url)
      const content = await response.text()
      
      const isVTT = url.includes('.vtt') || content.startsWith('WEBVTT')
      const subtitles = isVTT ? parseVTT(content) : parseSRT(content)
      
      const track: SubtitleTrack = {
        id: `track-${Date.now()}`,
        label,
        language,
        url,
        subtitles
      }
      
      setTracks(prev => {
        // Check if track already exists
        if (prev.some(t => t.id === track.id)) return prev
        return [...prev, track]
      })
      
      // Auto-select first track if none active
      setActiveTrackState(prev => {
        if (!prev) return track.id
        return prev
      })
      
      return track.id
    } catch (error) {
      console.error('Failed to load subtitles:', error)
      return null
    }
  }, [])

  // Add subtitles manually (for embedded subtitle data)
  const addSubtitleTrack = useCallback((subtitles: Subtitle[], label: string, language: string = 'en') => {
    const track: SubtitleTrack = {
      id: `track-${Date.now()}`,
      label,
      language,
      subtitles
    }
    
      setTracks(prev => {
        // Check if track already exists
        if (prev.some(t => t.id === track.id)) return prev
        return [...prev, track]
      })
      
      setActiveTrackState(prev => {
        if (!prev) return track.id
        return prev
      })
      
      return track.id
  }, [])

  // Set active track
  const setActiveTrack = useCallback((trackId: string | null) => {
    setActiveTrackState(trackId)
    if (trackId) {
      localStorage.setItem('subtitle-preference', trackId)
    }
  }, [])

  // Toggle subtitles on/off
  const toggleSubtitles = useCallback(() => {
    setIsEnabled(prev => !prev)
  }, [])

  // Clear all tracks
  const clearTracks = useCallback(() => {
    setTracks([])
    setActiveTrackState(null)
    setCurrentSubtitle('')
  }, [])

  // Update current subtitle based on video time
  useEffect(() => {
    const video = videoRef.current
    if (!video || !activeTrack || !isEnabled) {
      setCurrentSubtitle('')
      return
    }

    const activeTrackData = tracks.find(t => t.id === activeTrack)
    if (!activeTrackData) {
      setCurrentSubtitle('')
      return
    }

    const updateSubtitle = () => {
      const currentTime = video.currentTime
      const subtitle = activeTrackData.subtitles.find(
        sub => currentTime >= sub.start && currentTime <= sub.end
      )
      setCurrentSubtitle(subtitle?.text || '')
    }

    // Update more frequently for accurate subtitle timing
    intervalRef.current = window.setInterval(updateSubtitle, 100)
    updateSubtitle()

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [videoRef, activeTrack, tracks, isEnabled])

  return {
    tracks,
    activeTrack,
    currentSubtitle,
    isEnabled,
    loadSubtitles,
    addSubtitleTrack,
    setActiveTrack,
    toggleSubtitles,
    clearTracks
  }
}
