import { Check, Edit, LogIn, LogOut, Plus, Settings, Shield } from 'lucide-react'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { AnimatedBackground, ConfirmDialog, SimpleLayout, SkeletonProfile, StandardShell } from '../components'
import { ProfileModal } from '../components/features/ProfileModal'
import { ContextMenu } from '../components/ui/ContextMenu'
import { buildAvatarUrl, sanitizeImgSrc } from '../lib/url'
import { createLogger } from '../utils/client-logger'
import type { Profile, ProfilesScreenModel } from './ProfilesPage.model'
import styles from './ProfilesPage.module.css'

const log = createLogger('ProfilesPageStandard')

function ProfileCard({
  profile,
  onClick,
  onEdit,
}: {
  profile: Profile
  onClick: (profile: Profile) => void
  onEdit: (profile: Profile) => void
}) {
  return (
    <ContextMenu
      items={[
        {
          label: 'Edit Profile',
          icon: Edit,
          onClick: () => onEdit(profile),
        },
      ]}
    >
      <button
        type="button"
        className={styles.profileCard}
        onClick={() => onClick(profile)}
        aria-label={profile.isDefault ? `${profile.name}, default profile` : profile.name}
      >
        <div className={styles.profileAvatar}>
          <div id={`avatar-${profile.id}`}>
            <img
              src={sanitizeImgSrc(buildAvatarUrl(profile.avatar, profile.avatar_style || 'bottts-neutral'))}
              alt={profile.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={(event) => {
                log.error(`Avatar load failed for ${profile.name} (URL: ${event.currentTarget.src})`)
                event.currentTarget.style.opacity = '0'
              }}
            />
          </div>
        </div>
        <div className={styles.profileMeta}>
          <div className={styles.profileName}>{profile.name}</div>
          {profile.isDefault ? <div className={styles.profileStatus}>Default</div> : null}
        </div>
      </button>
    </ContextMenu>
  )
}

export function ProfilesPageStandardView({ model }: { model: ProfilesScreenModel }) {
  const gridRef = useRef<HTMLDivElement>(null)
  const [gridFade, setGridFade] = useState(false)

  useEffect(() => {
    const element = gridRef.current
    if (!element) return

    const update = () => {
      const overflows = element.scrollHeight > element.clientHeight + 1
      const atBottom = element.scrollTop + element.clientHeight >= element.scrollHeight - 4
      setGridFade(overflows && !atBottom)
    }

    update()
    const resizeObserver = new ResizeObserver(update)
    resizeObserver.observe(element)
    element.addEventListener('scroll', update, { passive: true })

    return () => {
      resizeObserver.disconnect()
      element.removeEventListener('scroll', update)
    }
  }, [model.profiles])

  return (
    <SimpleLayout title="Profiles">
      <AnimatedBackground />
      <StandardShell
        className={styles.pageShell}
        contentAs="main"
        contentClassName={styles.profilesPage}
      >
        <h1 className="sr-only">Profiles</h1>
        <div className={styles.profilesMain}>
          <section className={styles.profilesSection}>
            <h2 className={styles.sectionTitle} id="sectionTitle">
              {model.editMode ? 'Select profile to edit:' : "Who's watching?"}
            </h2>

            {model.loading ? (
              <div className={styles.profilesGrid} id="profilesGrid">
                {[1, 2, 3].map((index) => (
                  <SkeletonProfile key={index} />
                ))}
              </div>
            ) : (
              <div
                ref={gridRef}
                className={`${styles.profilesGrid}${gridFade ? ` ${styles.profilesGridFade}` : ''}`}
                id="profilesGrid"
              >
                {model.profiles.map((profile) => (
                  <ProfileCard
                    key={profile.id}
                    profile={profile}
                    onClick={model.actions.handleProfileClick}
                    onEdit={model.actions.handleEditProfile}
                  />
                ))}

                {(model.editMode || model.profiles.length === 0) ? (
                  <div>
                    <button
                      type="button"
                      className={styles.profileCard}
                      onClick={model.actions.handleCreateProfile}
                      aria-label="Add profile"
                    >
                      <div className={`${styles.profileAvatar} ${styles.addAvatar}`}>
                        <Plus size={36} aria-hidden="true" />
                      </div>
                      <div className={styles.profileMeta}>
                        <div className={styles.profileName}>Add Profile</div>
                      </div>
                    </button>
                  </div>
                ) : null}
              </div>
            )}
          </section>
        </div>

        <footer className={styles.footer}>
          <nav className={styles.footerNav} id="footerButtons" aria-label="Profile actions">
            <div
              className={styles.navGroup}
              style={{ '--active-index': model.editMode ? 1 : 0 } as CSSProperties}
            >
              <div className={styles.navIndicator} />
              <button
                type="button"
                id="settingsBtn"
                className={`${styles.navItem} ${!model.editMode ? styles.navItemActive : ''}`}
                aria-label="Settings"
                title="Settings"
                onClick={() => !model.editMode && model.navigation.goToSettings()}
              >
                <Settings size={20} aria-hidden="true" />
              </button>
              <button
                type="button"
                id="editModeBtn"
                className={`${styles.navItem} ${model.editMode ? styles.navItemActive : ''}`}
                aria-label={model.editMode ? 'Done editing' : 'Edit Profiles'}
                aria-pressed={model.editMode}
                title={model.editMode ? 'Done' : 'Edit Profiles'}
                onClick={model.actions.toggleEditMode}
                disabled={model.profiles.length === 0 && !model.editMode}
              >
                {model.editMode ? <Check size={20} aria-hidden="true" /> : <Edit size={20} aria-hidden="true" />}
              </button>
            </div>

            {model.isAdmin ? (
              <button
                type="button"
                id="adminBtn"
                className={styles.navItem}
                aria-label="Admin Panel"
                title="Admin Panel"
                onClick={model.navigation.goToAdmin}
              >
                <Shield size={20} aria-hidden="true" />
              </button>
            ) : null}

            <div className={styles.navDivider} />

            <button
              type="button"
              id="logoutBtn"
              className={`${styles.navItem} ${styles.navItemDanger}`}
              aria-label={model.isGuestMode ? 'Exit Local Mode' : 'Logout'}
              title={model.isGuestMode ? 'Exit Local Mode' : 'Logout'}
              onClick={model.actions.openLogoutConfirm}
            >
              {model.isGuestMode ? <LogIn size={20} aria-hidden="true" /> : <LogOut size={20} aria-hidden="true" />}
            </button>
          </nav>
        </footer>
      </StandardShell>

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
    </SimpleLayout>
  )
}

export default ProfilesPageStandardView
