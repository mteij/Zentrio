/**
 * CastCard - Display an actor's photo and role information
 */
import { User } from 'lucide-react'
import styles from '../../styles/Streaming.module.css'

export interface CastCardProps {
  name: string
  character: string
  photo: string | null
}

export function CastCard({ name, character, photo }: CastCardProps) {
  return (
    <div className={styles.castCard}>
      <div className={styles.castPhoto}>
        {photo ? (
          <img src={photo} alt={name} loading="lazy" />
        ) : (
          <div className={styles.castPhotoPlaceholder}>
            <User size={32} />
          </div>
        )}
      </div>
      <div className={styles.castInfo}>
        <span className={styles.castName}>{name}</span>
        <span className={styles.castCharacter}>{character}</span>
      </div>
    </div>
  )
}
