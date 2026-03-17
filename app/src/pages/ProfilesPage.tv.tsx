import { Edit, LogIn, LogOut, Plus, Settings, Shield } from 'lucide-react'
import { ConfirmDialog, LoadingSpinner } from '../components'
import { ProfileModal } from '../components/features/ProfileModal'
import { TvFocusItem, TvFocusZone, TvGrid, TvPageScaffold, TvSection } from '../components/tv'
import { buildAvatarUrl, sanitizeImgSrc } from '../lib/url'
import type { Profile, ProfilesScreenModel } from './ProfilesPage.model'
import styles from './ProfilesPage.tv.module.css'

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
    <TvFocusItem id={id} index={index} className={styles.profileCard} onActivate={onActivate} aria-label={profile.name}>
      <div className={styles.profileAvatar}>
        <img
          src={sanitizeImgSrc(buildAvatarUrl(profile.avatar, profile.avatar_style || 'bottts-neutral'))}
          alt={profile.name}
        />
      </div>
      <div className={styles.profileName}>{profile.name}</div>
      {profile.isDefault ? <div className={styles.profileStatus}>Default</div> : null}
    </TvFocusItem>
  )
}

export function ProfilesPageTvView({ model }: { model: ProfilesScreenModel }) {
  if (model.loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-black">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  const actionItems = [
    {
      id: 'edit',
      label: model.editMode ? 'Done' : 'Manage',
      icon: Edit,
      onActivate: model.actions.toggleEditMode,
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
      onActivate: model.navigation.goToSettings,
    },
    ...(model.isAdmin ? [{
      id: 'admin',
      label: 'Admin',
      icon: Shield,
      onActivate: model.navigation.goToAdmin,
    }] : []),
    {
      id: 'logout',
      label: model.isGuestMode ? 'Exit Local Mode' : 'Logout',
      icon: model.isGuestMode ? LogIn : LogOut,
      onActivate: model.actions.openLogoutConfirm,
    },
  ]

  const initialZoneId = model.profiles.length > 0 || !model.editMode ? 'profiles-grid' : 'profile-add'

  return (
    <TvPageScaffold
      eyebrow={model.editMode ? 'Manage Profiles' : 'Choose a Profile'}
      title={model.editMode ? 'Edit a profile' : "Who's Watching?"}
      description={model.editMode ? 'Pick a profile to update it.' : undefined}
      initialZoneId={initialZoneId}
      onBack={model.editMode ? () => model.actions.setEditMode(false) : model.navigation.goBack}
      railMode="compact"
      rail={(
        <TvFocusZone id="profiles-actions" orientation="vertical" nextRight="profiles-grid">
          {actionItems.map((item, index) => {
            const Icon = item.icon
            return (
              <TvFocusItem
                key={item.id}
                id={`profiles-action-${item.id}`}
                index={index}
                className={styles.actionCard}
                onActivate={item.onActivate}
              >
                <Icon size={20} />
                <span className={styles.actionText}>
                  <span className={styles.actionLabel}>{item.label}</span>
                </span>
              </TvFocusItem>
            )
          })}
        </TvFocusZone>
      )}
    >
      <TvSection
        title={model.editMode ? 'Profiles' : 'Profiles'}
        subtitle={undefined}
      >
        <TvGrid
          zoneId="profiles-grid"
          columns={5}
          nextLeft="profiles-actions"
          initialItemId={model.profiles.length > 0 ? `profile-${model.profiles[0].id}` : 'profile-add'}
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

          {model.editMode ? (
            <TvFocusItem
              id="profile-add"
              index={model.profiles.length}
              className={`${styles.profileCard} ${styles.addProfileCard}`}
              onActivate={model.actions.handleCreateProfile}
            >
              <div className={`${styles.profileAvatar} ${styles.addProfileAvatar}`}>
                <Plus size={40} />
              </div>
              <div className={styles.profileName}>Add Profile</div>
            </TvFocusItem>
          ) : null}
        </TvGrid>
      </TvSection>

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
        message={model.isGuestMode
          ? 'Exit local mode and return to the server selection screen? Your local data will be preserved.'
          : 'Are you sure you want to logout?'}
        confirmText={model.isGuestMode ? 'Exit' : 'Logout'}
        cancelText="Cancel"
        variant="danger"
      />
    </TvPageScaffold>
  )
}

export default ProfilesPageTvView
