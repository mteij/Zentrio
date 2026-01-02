/**
 * InfoModal - Modal for detailed "nerd" information about a movie/series
 * Contains cast, director, writer, production info, etc.
 */
import { X, User } from 'lucide-react'
import { useEffect } from 'react'
import styles from '../../styles/Streaming.module.css'
import { CastMember } from '../../services/addons/types'

interface InfoModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  director?: string[]
  cast?: CastMember[]
  country?: string
  runtime?: string
  released?: string
}

export function InfoModal({
  isOpen,
  onClose,
  title,
  director,
  cast,
  country,
  runtime,
  released
}: InfoModalProps) {
  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className={styles.infoModalOverlay} onClick={onClose}>
      <div className={styles.infoModalContent} onClick={e => e.stopPropagation()}>
        <button className={styles.infoModalClose} onClick={onClose}>
          <X size={24} />
        </button>

        <h2 className={styles.infoModalTitle}>{title}</h2>

        {/* Production Info */}
        <div className={styles.infoModalSection}>
          {released && (
            <div className={styles.infoModalRow}>
              <span className={styles.infoModalLabel}>Released:</span>
              <span>{released}</span>
            </div>
          )}
          {runtime && (
            <div className={styles.infoModalRow}>
              <span className={styles.infoModalLabel}>Runtime:</span>
              <span>{runtime}</span>
            </div>
          )}
          {country && (
            <div className={styles.infoModalRow}>
              <span className={styles.infoModalLabel}>Country:</span>
              <span>{country}</span>
            </div>
          )}
        </div>

        {/* Director */}
        {director && director.length > 0 && (
          <div className={styles.infoModalSection}>
            <h3 className={styles.infoModalSectionTitle}>Director</h3>
            <p className={styles.infoModalText}>{director.join(', ')}</p>
          </div>
        )}

        {/* Cast */}
        {cast && cast.length > 0 && (
          <div className={styles.infoModalSection}>
            <h3 className={styles.infoModalSectionTitle}>Cast</h3>
            <div className={styles.infoModalCastGrid}>
              {cast.map((actor, i) => (
                <div key={i} className={styles.infoModalCastItem}>
                  <div className={styles.infoModalCastPhoto}>
                    {actor.photo ? (
                      <img src={actor.photo} alt={actor.name} loading="lazy" />
                    ) : (
                      <User size={24} />
                    )}
                  </div>
                  <div className={styles.infoModalCastInfo}>
                    <span className={styles.infoModalCastName}>{actor.name}</span>
                    <span className={styles.infoModalCastCharacter}>{actor.character}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
