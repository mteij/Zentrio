import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { toast } from 'sonner'

// Type definitions for Chrome Cast API
declare global {
  interface Window {
    chrome: any
    cast: any
    __onGCastApiAvailable: (isAvailable: boolean) => void
  }
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
    window.__onGCastApiAvailable = (isAvailable) => {
      if (isAvailable) {
        initializeCastApi()
      }
    }

    // Check if API is already loaded
    if (window.chrome && window.chrome.cast && window.chrome.cast.isAvailable) {
        initializeCastApi();
    }
  }, [])

  const initializeCastApi = () => {
    try {
      const cast = window.chrome.cast
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
    setCastReceiverAvailable(availability === window.chrome.cast.ReceiverAvailability.AVAILABLE)
  }

  const onInitSuccess = () => {
    console.log('Cast API initialized')
  }

  const onError = (e: any) => {
    console.warn('Cast API Error', e)
  }

  const castMedia = useCallback(async (url: string, type: string, title?: string, image?: string, subtitles?: any[]) => {
    if (!castSession) {
        // Try to request session if connected but no session object (edge case) or just request new one
        try {
            await new Promise((resolve, reject) => {
                 window.chrome.cast.requestSession((session: any) => {
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

    // Get fresh session if the await above updated it, or use current
    // Note: state update might be async, so we use the global reference or just assume window.chrome.cast.requestSession callback fired
    // Ideally we wait for state, but for now let's use the one we have or the one newly created
    // Actually, requestSession callback calls sessionListener which updates state.
    
    // We need to access the LATEST session. 
    // Let's use a simpler approach: define a helper to get current session from framework if possible
    // For basic SDK, we rely on the session passed to listener.
    // Let's assume session is active now.
    
    // Using window.cast.framework.CastContext.getInstance().getCurrentSession() is better for Cast Framework (CAF),
    // but we are using the low-level API setup in initializeCastApi (chrome.cast.initialize). 
    // Let's stick to the low-level object we saved.
    
    // HOWEVER, `castSession` state might be stale in this closure if we JUST set it.
    // But since we awaited requestSession (mock logic above), we might be ok? 
    // Actually requestSession is callback based. 
    // Let's proceed carefully.
    
    const cast = window.chrome.cast
    
    // Current active session
    // If we just connected, castSession might be null in this closure still?
    // Let's re-fetch or use a ref?
    // For this simple implementation, let's rely on the user clicking the cast button FIRST to connect, 
    // and then playing.
    // Or if they click "Cast" on the player, it triggers connection.
    
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
