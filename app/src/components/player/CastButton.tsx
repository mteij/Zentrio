/**
 * CastButton - Custom Chromecast button for Vidstack
 */

import { useCallback } from 'react'
import { useCast } from '../../contexts/CastContext'
import { Cast } from 'lucide-react'

export function CastButton() {
    const { castReceiverAvailable, isConnected, disconnect } = useCast()
    
    const handleClick = useCallback(() => {
        if (isConnected) {
            disconnect()
        } else {
            // Trigger native Chrome cast dialog
            // The Vidstack googleCastButton slot normally handles this,
            // but we provide our own for custom styling/behavior
            const castBtn = document.querySelector('google-cast-launcher') as HTMLElement
            castBtn?.click()
        }
    }, [isConnected, disconnect])
    
    if (!castReceiverAvailable) {
        return null
    }
    
    return (
        <button
            className="vds-button"
            onClick={handleClick}
            aria-label={isConnected ? 'Disconnect Cast' : 'Cast to device'}
            data-active={isConnected}
        >
            <Cast size={24} className="vds-icon" />
        </button>
    )
}

export default CastButton
