import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { toast } from 'sonner'

// Type definitions for Chrome Cast API (using local types to avoid conflicts with Vidstack)
interface ChromeCastApi {
  isAvailable?: boolean
  SessionRequest: new (appId: string) => any
  ApiConfig: new (sessionRequest: any, sessionListener: any, receiverListener: any) => any
  initialize: (config: any, onSuccess: () => void, onError: (e: any) => void) => void
  requestSession: (onSuccess: (session: any) => void, onError: (e: any) => void) => void
  ReceiverAvailability: { AVAILABLE: string; UNAVAILABLE: string }
  media: {
    DEFAULT_MEDIA_RECEIVER_APP_ID: string
    MediaInfo: new (url: string, type: string) => any
    GenericMediaMetadata: new () => any
    MetadataType: { GENERIC: number }
    LoadRequest: new (mediaInfo: any) => any
  }
}

// Helper to safely access Chrome Cast API
const getChromeCast = (): ChromeCastApi | undefined => {
  const win = window as any
  return win?.chrome?.cast
}

const setGCastCallback = (callback: (isAvailable: boolean) => void) => {
  (window as any).__onGCastApiAvailable = callback
}

interface CastContextType {
  castReceiverAvailable: boolean
  castSession: any | null
  isConnected: boolean
  castMedia: (url: string, type: string, title?: string, image?: string, subtitles?: any[]) => Promise<void>
  disconnect: () => void
}

const CastContext = createContext<CastContextType | undefined>(undefined)

export function CastProvider({ children }: { children: React.ReactNode }) {
  const [castReceiverAvailable, setCastReceiverAvailable] = useState(false)
  const [castSession, setCastSession] = useState<any>(null)
  const [isConnected, setIsConnected] = useState(false)
  const contextValueRef = useRef<any>(null)

  // Initialize Cast API
  useEffect(() => {
    // Callback for when the Cast API is loaded
    setGCastCallback((isAvailable) => {
      if (isAvailable) {
        initializeCastApi()
      }
    })

    // Check if API is already loaded
    const cast = getChromeCast()
    if (cast?.isAvailable) {
        initializeCastApi();
    }
  }, [])

  const initializeCastApi = () => {
    try {
      const cast = getChromeCast()
      if (!cast) return
      
      const sessionRequest = new cast.SessionRequest(cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID)
      
      const apiConfig = new cast.ApiConfig(
        sessionRequest,
        sessionListener,
        receiverListener
      )

      cast.initialize(apiConfig, onInitSuccess, onError)
    } catch (e) {
      console.error('Cast initialization error', e)
    }
  }

  const sessionListener = (session: any) => {
    console.log('Cast Session established', session.sessionId)
    setCastSession(session)
    setIsConnected(true)
    session.addUpdateListener(sessionUpdateListener)
  }

  const sessionUpdateListener = (isAlive: boolean) => {
    if (!isAlive) {
      setCastSession(null)
      setIsConnected(false)
    }
  }

  const receiverListener = (availability: string) => {
    // availability: "available" | "unavailable"
    console.log('Cast Receiver availability:', availability)
    const cast = getChromeCast()
    setCastReceiverAvailable(availability === cast?.ReceiverAvailability?.AVAILABLE)
  }

  const onInitSuccess = () => {
    console.log('Cast API initialized')
  }

  const onError = (e: any) => {
    console.warn('Cast API Error', e)
  }

  const castMedia = useCallback(async (url: string, type: string, title?: string, image?: string, subtitles?: any[]) => {
    const cast = getChromeCast()
    if (!cast) {
      toast.error("Cast API not available")
      return
    }
    
    if (!castSession) {
        // Try to request session if connected but no session object (edge case) or just request new one
        try {
            await new Promise((resolve, reject) => {
                 cast.requestSession((session: any) => {
                     sessionListener(session)
                     resolve(session)
                 }, reject)
            });
        } catch (e) {
            console.error("Failed to request session", e)
            toast.error("Could not connect to Chromecast")
            return;
        }
    }
    
    // If not connected, request session
    let currentSession = castSession;
    if (!currentSession) {
         try {
             currentSession = await new Promise((resolve, reject) => {
                 cast.requestSession((s: any) => {
                     sessionListener(s)
                     resolve(s)
                 }, reject)
             })
         } catch(e) {
             return; // User cancelled or error
         }
    }
    
    if (!currentSession) return;

    const mediaInfo = new cast.media.MediaInfo(url, type)
    mediaInfo.metadata = new cast.media.GenericMediaMetadata()
    mediaInfo.metadata.metadataType = cast.media.MetadataType.GENERIC
    mediaInfo.metadata.title = title || 'Zentrio Stream'
    
    if (image) {
        mediaInfo.metadata.images = [{ url: image }]
    }
    
    // Subtitles handling would go here - basic text tracks
    // For now simple video
    
    const request = new cast.media.LoadRequest(mediaInfo)
    request.autoplay = true
    
    try {
        await new Promise((resolve, reject) => {
            currentSession.loadMedia(request, resolve, reject)
        })
        toast.success(`Casting to ${currentSession.receiver.friendlyName}`)
    } catch (e) {
        console.error("Cast load media failed", e)
        toast.error("Failed to cast media")
    }
  }, [castSession])

  const disconnect = useCallback(() => {
      if (castSession) {
          castSession.leave(
              () => {
                  setCastSession(null)
                  setIsConnected(false)
                  toast.info("Disconnected from Cast")
              },
              (e: any) => console.error("Cast leave error", e) 
          )
      }
  }, [castSession])

  return (
    <CastContext.Provider value={{ castReceiverAvailable, castSession, isConnected, castMedia, disconnect }}>
      {children}
    </CastContext.Provider>
  )
}

export function useCast() {
  const context = useContext(CastContext)
  if (context === undefined) {
    throw new Error('useCast must be used within a CastProvider')
  }
  return context
}
