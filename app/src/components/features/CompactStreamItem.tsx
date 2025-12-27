import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Zap, HardDrive, Users, Volume2, Info, X, Globe, Film, Monitor } from 'lucide-react'
import { FlatStream } from '../../hooks/useStreamLoader'

interface CompactStreamItemProps {
  item: FlatStream
  onClick: () => void
  index: number
  showAddonName?: boolean
  mode?: 'simple' | 'advanced'  // simple = essential tags, advanced = all tags
}

// Format bytes to human readable
function formatSize(bytes?: number): string | null {
  if (!bytes) return null
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GB`
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)}MB`
  return null
}

// Format source type for display
function formatSourceType(type?: string): string | null {
  if (!type || type === 'unknown') return null
  const map: Record<string, string> = {
    bluray: 'BluRay', web: 'WEB', hdtv: 'HDTV', telesync: 'TS', cam: 'CAM'
  }
  return map[type] || type.toUpperCase()
}

// Map language names to country codes for flags
const languageToCountry: Record<string, string> = {
  'English': 'gb', 'Dutch': 'nl', 'German': 'de', 'French': 'fr', 'Spanish': 'es',
  'Italian': 'it', 'Portuguese': 'pt', 'Russian': 'ru', 'Japanese': 'jp', 'Korean': 'kr',
  'Chinese': 'cn', 'Arabic': 'sa', 'Hindi': 'in', 'Turkish': 'tr', 'Polish': 'pl',
  'Swedish': 'se', 'Norwegian': 'no', 'Danish': 'dk', 'Finnish': 'fi', 'Czech': 'cz',
  'Hungarian': 'hu', 'Romanian': 'ro', 'Greek': 'gr', 'Hebrew': 'il', 'Thai': 'th',
  'Vietnamese': 'vn', 'Indonesian': 'id', 'Ukrainian': 'ua', 'Bulgarian': 'bg',
  'Brazilian': 'br', 'Mexican': 'mx', 'Argentinian': 'ar', 'Canadian': 'ca'
}

// SVG Flag component using flagcdn.com
function FlagIcon({ language, size = 16 }: { language: string; size?: number }) {
  const countryCode = languageToCountry[language]
  if (!countryCode) {
    return <Globe size={size} style={{ opacity: 0.5 }} />
  }
  return (
    <img
      src={`https://flagcdn.com/w40/${countryCode}.png`}
      srcSet={`https://flagcdn.com/w80/${countryCode}.png 2x`}
      width={size}
      height={Math.round(size * 0.75)}
      alt={language}
      title={language}
      style={{ 
        borderRadius: '2px',
        objectFit: 'cover',
        display: 'inline-block',
        verticalAlign: 'middle'
      }}
    />
  )
}

// Get resolution color
function getResolutionColor(res?: string): string {
  switch (res?.toLowerCase()) {
    case '4k': return 'linear-gradient(135deg, #ffd700, #ff8c00)'
    case '1080p': return 'linear-gradient(135deg, #4ade80, #22c55e)'
    case '720p': return 'linear-gradient(135deg, #60a5fa, #3b82f6)'
    case '480p': return 'linear-gradient(135deg, #a78bfa, #8b5cf6)'
    default: return 'rgba(255,255,255,0.15)'
  }
}

/**
 * Info Overlay Modal - Clean, minimal glassmorphism
 */
function InfoOverlay({ item, onClose }: { item: FlatStream; onClose: () => void }) {
  const { stream, addon, parsed } = item
  
  const resolution = parsed?.resolution?.toUpperCase() || 'Unknown'
  const size = formatSize(parsed?.size)
  const sourceType = formatSourceType(parsed?.sourceType) || 'Unknown'
  const seeders = parsed?.seeders
  const audioTags = parsed?.audioTags || []
  const audioChannels = parsed?.audioChannels || []
  const visualTags = parsed?.visualTags || []
  const encode = parsed?.encode || []
  const languages = parsed?.languages || []
  const isCached = parsed?.isCached

  const InfoRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'space-between', 
      alignItems: 'center',
      padding: '10px 0',
      borderBottom: '1px solid rgba(255, 255, 255, 0.06)'
    }}>
      <span style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.85rem' }}>{label}</span>
      <span style={{ color: '#fff', fontSize: '0.85rem', textAlign: 'right' }}>{value}</span>
    </div>
  )

  return createPortal(
    <div
      onClick={(e) => { e.stopPropagation(); onClose() }}
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '20px'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'rgba(24, 24, 27, 0.9)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderRadius: '16px',
          maxWidth: '420px',
          width: '100%',
          maxHeight: '80vh',
          overflow: 'hidden',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)'
        }}
      >
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1rem', color: '#fff', fontWeight: 500 }}>Stream Info</h3>
            <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)' }}>{addon.name}</span>
          </div>
          <button
            onClick={onClose}
            style={{ 
              background: 'rgba(255, 255, 255, 0.06)', 
              border: 'none', 
              color: 'rgba(255,255,255,0.6)', 
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '8px',
              display: 'flex'
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '4px 20px 20px', overflowY: 'auto', maxHeight: 'calc(80vh - 120px)' }}>
          <InfoRow label="Resolution" value={resolution} />
          <InfoRow label="Source" value={sourceType} />
          
          {encode.length > 0 && (
            <InfoRow label="Video Codec" value={encode.map(e => e.toUpperCase()).join(', ')} />
          )}
          
          {(audioTags.length > 0 || audioChannels.length > 0) && (
            <InfoRow 
              label="Audio" 
              value={
                <>
                  {audioTags.map(a => a.toUpperCase()).join(', ')}
                  {audioChannels.length > 0 && ` (${audioChannels.join(', ')})`}
                </>
              } 
            />
          )}
          
          {visualTags.length > 0 && (
            <InfoRow label="Video" value={visualTags.map(v => v.toUpperCase()).join(', ')} />
          )}
          
          {size && <InfoRow label="Size" value={size} />}
          
          {seeders !== undefined && seeders > 0 && (
            <InfoRow label="Seeders" value={seeders} />
          )}
          
          {isCached && (
            <InfoRow label="Status" value={<span style={{ color: '#4ade80' }}>Cached</span>} />
          )}
          
          {languages.length > 0 && (
            <InfoRow 
              label="Languages" 
              value={
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  {languages.map(lang => <FlagIcon key={lang} language={lang} size={16} />)}
                </div>
              } 
            />
          )}

          {/* Description */}
          {stream.description && (
            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
              <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', display: 'block', marginBottom: '8px' }}>
                Raw Info
              </span>
              <span style={{ 
                color: 'rgba(255,255,255,0.7)', 
                fontSize: '0.8rem', 
                lineHeight: 1.5, 
                whiteSpace: 'pre-wrap',
                display: 'block'
              }}>
                {stream.description}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

/**
 * Compact Stream Item - Streamlined tags
 * Shows: Cached, Resolution, Source, HDR/DV, Size, Languages, Info button
 */
export function CompactStreamItem({ item, onClick, index, showAddonName = false, mode = 'simple' }: CompactStreamItemProps) {
  const [showInfoOverlay, setShowInfoOverlay] = useState(false)
  const { stream, addon, parsed } = item
  
  const isCached = parsed?.isCached ?? false
  const resolution = parsed?.resolution?.toUpperCase() || ''
  const size = formatSize(parsed?.size)
  const sourceType = formatSourceType(parsed?.sourceType)
  const visualTags = parsed?.visualTags || []
  const languages = parsed?.languages || []
  // Advanced mode extras
  const audioTags = parsed?.audioTags || []
  const audioChannels = parsed?.audioChannels || []
  const encode = parsed?.encode || []
  const seeders = parsed?.seeders
  const primaryAudio = audioTags[0]?.toUpperCase()
  const primaryChannel = audioChannels[0]

  return (
    <>
      <div
        onClick={onClick}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '10px 14px',
          background: isCached 
            ? 'linear-gradient(90deg, rgba(34, 197, 94, 0.1), rgba(34, 197, 94, 0.02))' 
            : 'rgba(255, 255, 255, 0.03)',
          borderRadius: '10px',
          cursor: 'pointer',
          border: isCached 
            ? '1px solid rgba(34, 197, 94, 0.15)' 
            : '1px solid rgba(255, 255, 255, 0.05)',
          transition: 'all 0.2s ease',
          flexWrap: 'wrap'
        }}
      >
        {/* Cached indicator */}
        {isCached && (
          <span style={{ display: 'flex', alignItems: 'center', color: '#22c55e', flexShrink: 0 }} title="Cached">
            <Zap size={14} />
          </span>
        )}

        {/* Resolution */}
        {resolution && (
          <span style={{
            background: getResolutionColor(resolution),
            padding: '3px 8px',
            borderRadius: '6px',
            fontSize: '0.75rem',
            fontWeight: 600,
            color: '#fff',
            flexShrink: 0
          }}>
            {resolution}
          </span>
        )}

        {/* Source type */}
        {sourceType && (
          <span style={{ 
            background: 'rgba(255, 255, 255, 0.08)', 
            padding: '3px 8px', 
            borderRadius: '6px', 
            fontSize: '0.7rem', 
            color: '#d1d5db', 
            flexShrink: 0 
          }}>
            {sourceType}
          </span>
        )}

        {/* Visual tags (HDR, DV) */}
        {visualTags.map(tag => (
          <span
            key={tag}
            style={{
              background: tag === 'dv' ? 'linear-gradient(135deg, #ec4899, #8b5cf6)' : 'linear-gradient(135deg, #f59e0b, #ef4444)',
              padding: '3px 8px',
              borderRadius: '6px',
              fontSize: '0.7rem',
              fontWeight: 600,
              color: '#fff',
              flexShrink: 0
            }}
          >
            {tag.toUpperCase()}
          </span>
        ))}

        {/* Advanced mode: Audio codec + channel */}
        {mode === 'advanced' && (primaryAudio || primaryChannel) && (
          <span style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '4px', 
            background: 'rgba(139, 92, 246, 0.15)', 
            padding: '3px 8px', 
            borderRadius: '6px', 
            fontSize: '0.7rem', 
            color: '#c4b5fd', 
            flexShrink: 0 
          }}>
            <Volume2 size={10} />
            {primaryAudio}{primaryChannel ? ` ${primaryChannel}` : ''}
          </span>
        )}

        {/* Advanced mode: Video codec */}
        {mode === 'advanced' && encode.length > 0 && (
          <span style={{ 
            background: 'rgba(59, 130, 246, 0.15)', 
            padding: '3px 8px', 
            borderRadius: '6px', 
            fontSize: '0.7rem', 
            color: '#93c5fd', 
            flexShrink: 0 
          }}>
            {encode[0].toUpperCase()}
          </span>
        )}

        {/* Size */}
        {size && (
          <span style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '4px', 
            background: 'rgba(255, 255, 255, 0.06)', 
            padding: '3px 8px', 
            borderRadius: '6px', 
            fontSize: '0.7rem', 
            color: '#9ca3af', 
            flexShrink: 0 
          }}>
            <HardDrive size={10} />
            {size}
          </span>
        )}

        {/* Advanced mode: Seeders */}
        {mode === 'advanced' && seeders !== undefined && seeders > 0 && (
          <span style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            background: seeders > 50 ? 'rgba(34, 197, 94, 0.15)' : seeders > 10 ? 'rgba(250, 204, 21, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            padding: '3px 8px',
            borderRadius: '6px',
            fontSize: '0.7rem',
            color: seeders > 50 ? '#86efac' : seeders > 10 ? '#fde047' : '#fca5a5',
            flexShrink: 0
          }}>
            <Users size={10} />
            {seeders}
          </span>
        )}

        {/* Languages - all flags */}
        {languages.length > 0 && (
          <span 
            style={{ 
              background: 'rgba(255, 255, 255, 0.06)', 
              padding: '4px 8px', 
              borderRadius: '6px', 
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
            title={languages.join(', ')}
          >
            {languages.map(l => <FlagIcon key={l} language={l} size={14} />)}
          </span>
        )}

        {/* Addon name (optional) */}
        {showAddonName && (
          <span style={{ 
            marginLeft: 'auto', 
            background: 'rgba(255, 255, 255, 0.04)', 
            padding: '3px 8px', 
            borderRadius: '6px', 
            fontSize: '0.65rem', 
            color: '#6b7280', 
            flexShrink: 0 
          }}>
            {addon.name}
          </span>
        )}

        {/* Info button */}
        <button
          onClick={(e) => { e.stopPropagation(); e.preventDefault(); setShowInfoOverlay(true) }}
          style={{
            marginLeft: showAddonName ? '0' : 'auto',
            background: 'rgba(255, 255, 255, 0.06)',
            border: 'none',
            padding: '6px',
            borderRadius: '8px',
            cursor: 'pointer',
            color: '#6b7280',
            display: 'flex',
            alignItems: 'center',
            flexShrink: 0,
            transition: 'all 0.2s'
          }}
          title="More details"
        >
          <Info size={14} />
        </button>
      </div>

      {showInfoOverlay && <InfoOverlay item={item} onClose={() => setShowInfoOverlay(false)} />}
    </>
  )
}
