import { useParams, useNavigate } from 'react-router-dom'
import { Layout } from '../layout/Layout'
import { Navbar } from '../layout/Navbar'
import { SkeletonHero } from '../ui/SkeletonHero'
import { SkeletonRow } from '../ui/SkeletonRow'
import { SkeletonDetails } from '../ui/SkeletonDetails'
import styles from '../../styles/Streaming.module.css'

export function StreamingHomeSkeleton() {
  const { profileId } = useParams<{ profileId: string }>()
  return (
    <Layout title="Streaming" showHeader={false} showFooter={false}>
      <Navbar profileId={parseInt(profileId || '0')} activePage="home" />
      <div className={styles.streamingLayout}>
        {/* Force hero skeleton to matching height/style */}
        <SkeletonHero />
        <div className={styles.contentContainer} style={{ marginTop: '-100px' }}>
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      </div>
    </Layout>
  )
}

export function StreamingDetailsSkeleton() {
  const navigate = useNavigate()
  return (
    <Layout title="Loading..." showHeader={false} showFooter={false}>
      <button onClick={() => navigate(-1)} className={styles.backBtn}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
          </svg>
          Back
      </button>
      <SkeletonDetails />
    </Layout>
  )
}
