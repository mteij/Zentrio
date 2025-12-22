/**
 * ExternalPlayerButton - Open stream in external player (VLC, etc.)
 */

import { useState, useCallback } from 'react'
import { useExternalPlayer } from '../../hooks/useExternalPlayer'
import { ExternalLink } from 'lucide-react'
import { toast } from 'sonner'

interface ExternalPlayerButtonProps {
    streamUrl: string
    title?: string
}

export function ExternalPlayerButton({ streamUrl, title }: ExternalPlayerButtonProps) {
    const { openInPlayer, getAvailablePlayers } = useExternalPlayer()
    const [menuOpen, setMenuOpen] = useState(false)
    
    const handlePlayerSelect = useCallback(async (playerId: string) => {
        setMenuOpen(false)
        const result = await openInPlayer(playerId as any, { url: streamUrl, title })
        
        if (result.success) {
            toast.success(result.message)
        } else {
            toast.error(result.message)
        }
    }, [openInPlayer, streamUrl, title])
    
    const players = getAvailablePlayers()
    
    return (
        <div className="vds-menu" style={{ position: 'relative' }}>
            <button
                className="vds-button"
                onClick={() => setMenuOpen(!menuOpen)}
                aria-label="Open in external player"
                aria-expanded={menuOpen}
            >
            <ExternalLink size={24} className="vds-icon" />
            </button>
            
            {menuOpen && (
                <div 
                    className="vds-menu-items"
                    style={{
                        position: 'absolute',
                        bottom: '100%',
                        right: 0,
                        marginBottom: '8px',
                        minWidth: '160px',
                        background: 'rgba(20, 20, 20, 0.95)',
                        backdropFilter: 'blur(10px)',
                        borderRadius: '8px',
                        padding: '4px 0',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
                        zIndex: 100
                    }}
                >
                    {players.map(player => (
                        <button
                            key={player.id}
                            className="vds-menu-item"
                            onClick={() => handlePlayerSelect(player.id)}
                            style={{
                                display: 'block',
                                width: '100%',
                                padding: '10px 16px',
                                textAlign: 'left',
                                color: '#fff',
                                background: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                fontSize: '14px'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                            {player.name}
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}

export default ExternalPlayerButton
