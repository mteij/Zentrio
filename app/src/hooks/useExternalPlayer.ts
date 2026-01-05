import { useCallback } from 'react'

interface ExternalPlayerOptions {
  url: string
  title?: string
}

type ExternalPlayerType = 'vlc' | 'mpc' | 'potplayer' | 'iina' | 'system' | 'copy'

export function useExternalPlayer() {
  const isTauri = !!(window as any).__TAURI__

  // Generate protocol URL for different players
  const getPlayerUrl = useCallback((player: ExternalPlayerType, url: string): string | null => {
    switch (player) {
      case 'vlc':
        return `vlc:${url}`
      case 'mpc':
        return `mpc-hc://${url}`
      case 'potplayer':
        return `potplayer://${url}`
      case 'iina':
        return `iina://weblink?url=${encodeURIComponent(url)}`
      default:
        return null
    }
  }, [])

  // Open in external player
  const openInPlayer = useCallback(async (player: ExternalPlayerType, options: ExternalPlayerOptions) => {
    const { url, title } = options

    if (player === 'copy') {
      await navigator.clipboard.writeText(url)
      return { success: true, message: 'URL copied to clipboard' }
    }

    if (player === 'system' && isTauri) {
      try {
        const { openUrl } = await import('@tauri-apps/plugin-opener')
        await openUrl(url)
        return { success: true, message: 'Opened in system player' }
      } catch (error) {
        console.error('Failed to open in system player:', error)
        return { success: false, message: 'Failed to open in system player' }
      }
    }

    const protocolUrl = getPlayerUrl(player, url)
    if (protocolUrl) {
      window.open(protocolUrl, '_blank')
      return { success: true, message: `Opening in ${player.toUpperCase()}` }
    }

    return { success: false, message: 'Unsupported player' }
  }, [isTauri, getPlayerUrl])

  // Get available players based on platform
  const getAvailablePlayers = useCallback((): { id: ExternalPlayerType; name: string; icon?: string }[] => {
    const players: { id: ExternalPlayerType; name: string; icon?: string }[] = [
      { id: 'vlc', name: 'VLC Media Player' },
      { id: 'mpc', name: 'MPC-HC' },
      { id: 'potplayer', name: 'PotPlayer' },
      { id: 'copy', name: 'Copy URL' }
    ]

    // Add system player for Tauri
    if (isTauri) {
      players.unshift({ id: 'system', name: 'System Default' })
    }

    // Add IINA for macOS
    const isMac = navigator.platform.toLowerCase().includes('mac')
    if (isMac) {
      players.splice(1, 0, { id: 'iina', name: 'IINA' })
    }

    return players
  }, [isTauri])

  return {
    openInPlayer,
    getAvailablePlayers,
    isTauri
  }
}
