/**
 * ExternalPlayerButton - Open stream in external player (VLC, etc.)
 */

import { useCallback } from 'react'
import { useExternalPlayer } from '../../hooks/useExternalPlayer'
import { ExternalLink } from 'lucide-react'
import { toast } from 'sonner'

interface ExternalPlayerButtonProps {
    streamUrl: string
    title?: string
}

export function ExternalPlayerButton({ streamUrl, title }: ExternalPlayerButtonProps) {
    const { openExternal } = useExternalPlayer()
    
    const handleOpen = useCallback(async () => {
        const result = await openExternal({ url: streamUrl, title })
        
        if (result.success) {
            toast.success(result.message)
        } else {
            toast.error(result.message)
        }
    }, [openExternal, streamUrl, title])
    
    return (
        <button
            className="vds-button"
            onClick={handleOpen}
            aria-label="Open in external player"
        >
            <ExternalLink size={24} className="vds-icon" />
        </button>
    )
}

export default ExternalPlayerButton
