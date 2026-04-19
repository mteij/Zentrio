import { Check, Edit, LogIn, LogOut, Plus, Settings, Shield } from 'lucide-react'
import { ConfirmDialog } from '../components'
import { ProfileModal } from '../components/features/ProfileModal'
import { TvActionStrip, TvFocusItem, TvFocusScope, TvFocusZone } from '../components/tv'
import { buildAvatarUrl, sanitizeImgSrc } from '../lib/url'
import type { Profile, ProfilesScreenModel } from './ProfilesPage.model'
import styles from './ProfilesPage.tv.module.css'

function getGridColumns(itemCount: number) {
  if (itemCount <= 1) return 1
  if (itemCount <= 4) return itemCount
  if (itemCount <= 6) return 3
  if (itemCount <= 9) return 4
  return 5
}

function TvProfileCard({
  id,
  index,
  profile,
  onActivate,
}: {
  id: string
  index: number
  profile: Profile
  onActivate: () => void
}) {
  return (
    <TvFocusItem
      id={id}
      index={index}
      className={styles.profileCard}
      onActivate={onActivate}
      aria-label={profile.name}
    >
      <div className={styles.profileAvatar}>
        <img
          src={sanitizeImgSrc(
            buildAvatarUrl(profile.avatar, profile.avatar_style || 'bottts-neutral')
          )}
          alt={profile.name}
        />
      </div>
      <div className={styles.profileName}>{profile.name}</div>
    </TvFocusItem>
  )
}

function TvActionButton({
  id,
  icon: Icon,
  index,
  active = false,
  ariaLabel,
  onActivate,
  danger = false,
}: {
  id: string
  icon: typeof Settings
  index: number
  active?: boolean
  ariaLabel: string
  onActivate: () => void
  danger?: boolean
}) {
  return (
    <TvFocusItem
      id={id}
      index={index}
      className={`${styles.actionButton} ${active ? styles.actionButtonActive : ''} ${danger ? styles.actionButtonDanger : ''}`}
      aria-label={ariaLabel}
      onActivate={onActivate}
    >
      <Icon size={20} />
    </TvFocusItem>
  )
}

export function ProfilesPageTvView({ model }: { model: ProfilesScreenModel }) {
  if (model.loading) {
    return (
      <div className={styles.scope}>
        <div className={styles.page}>
          <div className={styles.hero}>
            <div className="h-3 w-32 rounded-full bg-white/10 animate-pulse" />
            <div className="h-10 w-64 rounded-lg bg-white/[0.07] animate-pulse mt-2" />
          </div>
          <div className={styles.grid} style={{ ['--profiles-grid-columns' as string]: 4 }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className={styles.profileCard} style={{ pointerEvents: 'none' }}>
                <div className="w-[124px] h-[124px] rounded-full bg-white/[0.06] animate-pulse" />
                <div className="h-4 w-24 rounded bg-white/[0.05] animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  const showAddProfile = model.editMode || model.profiles.length === 0
  const totalGridItems = model.profiles.length + (showAddProfile ? 1 : 0)
  const gridColumns = getGridColumns(totalGridItems)
  const initialZoneId = totalGridItems > 0 ? 'profiles-grid' : 'profiles-actions'

  return (
    <TvFocusScope
      initialZoneId={initialZoneId}
      onBack={model.editMode ? () => model.actions.setEditMode(false) : model.navigation.goBack}
      className={styles.scope}
    >
      <main className={styles.page}>
        <section className={styles.hero}>
          <p className={styles.eyebrow}>{model.editMode ? 'Manage Profiles' : 'Profiles'}</p>
          <h1 className={styles.title}>
            {model.editMode ? 'Choose a profile to edit' : "Who's Watching?"}
          </h1>
        </section>

        <TvFocusZone
          id="profiles-grid"
          orientation="grid"
          columns={gridColumns}
          nextDown="profiles-actions"
        >
          <div
            className={styles.grid}
            style={{ ['--profiles-grid-columns' as string]: String(gridColumns) }}
          >
            {model.profiles.map((profile, index) => (
              <TvProfileCard
                key={profile.id}
                id={`profile-${profile.id}`}
                index={index}
                profile={profile}
                onActivate={() => model.actions.handleProfileClick(profile)}
              />
            ))}

            {showAddProfile ? (
              <TvFocusItem
                id="profile-add"
                index={model.profiles.length}
                className={`${styles.profileCard} ${styles.addProfileCard}`}
                onActivate={model.actions.handleCreateProfile}
                aria-label="Add profile"
              >
                <div className={`${styles.profileAvatar} ${styles.addProfileAvatar}`}>
                  <Plus size={42} />
                </div>
                <div className={styles.profileName}>Add Profile</div>
              </TvFocusItem>
            ) : null}
          </div>
        </TvFocusZone>

        <div className={styles.footerDock}>
          <TvActionStrip zoneId="profiles-actions" nextUp="profiles-grid">
            <TvActionButton
              id="profiles-settings"
              index={0}
              icon={Settings}
              ariaLabel="Settings"
              onActivate={model.navigation.goToSettings}
            />
            <TvActionButton
              id="profiles-manage"
              index={1}
              icon={model.editMode ? Check : Edit}
              active={model.editMode}
              ariaLabel={model.editMode ? 'Done editing profiles' : 'Manage profiles'}
              onActivate={model.actions.toggleEditMode}
            />
            {model.isAdmin ? (
              <TvActionButton
                id="profiles-admin"
                index={2}
                icon={Shield}
                ariaLabel="Admin panel"
                onActivate={model.navigation.goToAdmin}
              />
            ) : null}
            <TvActionButton
              id="profiles-logout"
              index={model.isAdmin ? 3 : 2}
              icon={model.isGuestMode ? LogIn : LogOut}
              ariaLabel={model.isGuestMode ? 'Exit local mode' : 'Logout'}
              onActivate={model.actions.openLogoutConfirm}
              danger
            />
          </TvActionStrip>
        </div>
      </main>

      {model.showModal ? (
        <ProfileModal
          isOpen={model.showModal}
          onClose={model.actions.handleModalClose}
          profile={model.editingProfile}
          onSave={model.actions.handleProfileSaved}
        />
      ) : null}

      <ConfirmDialog
        isOpen={model.showLogoutConfirm}
        onClose={model.actions.closeLogoutConfirm}
        onConfirm={model.actions.confirmLogout}
        title={model.isGuestMode ? 'Exit Local Mode' : 'Logout'}
        message={
          model.isGuestMode
            ? 'Exit local mode and return to the server selection screen? Your local data will be preserved.'
            : 'Are you sure you want to logout?'
        }
        confirmText={model.isGuestMode ? 'Exit' : 'Logout'}
        cancelText="Cancel"
        variant="danger"
      />
    </TvFocusScope>
  )
}

export default ProfilesPageTvView
