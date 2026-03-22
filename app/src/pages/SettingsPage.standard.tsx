import { ArrowLeft } from 'lucide-react'
import { AnimatedBackground, SimpleLayout, StandardShell, StandardTopBar } from '../components'
import { SettingsProfileSelector } from '../components/features/SettingsProfileSelector'
import { AddonManager } from '../components/settings/AddonManager'
import { AppearanceSettings } from '../components/settings/AppearanceSettings'
import { DangerZoneSettings } from '../components/settings/DangerZoneSettings'
import { DownloadSettings } from '../components/settings/DownloadSettings'
import { GeneralSettings } from '../components/settings/GeneralSettings'
import { StreamingSettings } from '../components/settings/StreamingSettings'
import type { SettingsScreenModel } from './SettingsPage.model'
import styles from '../styles/Settings.module.css'

function renderActiveSection(model: SettingsScreenModel) {
  if (model.effectiveTab === 'general') return <GeneralSettings />
  if (model.effectiveTab === 'addons') {
    return (
      <AddonManager
        currentProfileId={model.currentProfileId}
        onProfileChange={model.actions.handleProfileChange}
      />
    )
  }
  if (model.effectiveTab === 'appearance') {
    return (
      <AppearanceSettings
        currentProfileId={model.currentProfileId}
        onProfileChange={model.actions.handleProfileChange}
      />
    )
  }
  if (model.effectiveTab === 'streaming') {
    return (
      <StreamingSettings
        currentProfileId={model.currentProfileId}
        onProfileChange={model.actions.handleProfileChange}
      />
    )
  }
  if (model.effectiveTab === 'downloads') {
    return (
      <DownloadSettings
        currentProfileId={model.currentProfileId}
        onProfileChange={model.actions.handleProfileChange}
      />
    )
  }
  if (model.effectiveTab === 'danger') return <DangerZoneSettings />
  return <GeneralSettings />
}

export function SettingsPageStandardView({ model }: { model: SettingsScreenModel }) {
  const mobileHeader = (
    <div className={styles.mobileHeader}>
      <StandardTopBar
        title="Settings"
        className={styles.mobileHeaderBar}
        leftSlot={(
          <button
            type="button"
            className={styles.mobileBackBtn}
            onClick={model.navigation.goBack}
            aria-label="Back to Profiles"
          >
            <ArrowLeft size={16} aria-hidden="true" />
          </button>
        )}
      />

      <div className={styles.mobileSectionTabsWrap}>
        {model.canScrollMobileLeft ? <div className={`${styles.mobileTabsFade} ${styles.mobileTabsFadeLeft}`} aria-hidden="true" /> : null}
        <div
          className={styles.mobileSectionTabs}
          role="tablist"
          aria-label="Settings sections"
          ref={model.mobileTabsRef}
          onScroll={model.actions.updateMobileTabsOverflow}
        >
          {model.tabItems.map((tab) => {
            const TabIcon = tab.icon
            const isActive = model.effectiveTab === tab.key
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={`${styles.mobileSectionTab} ${isActive ? styles.mobileSectionTabActive : ''}`}
                onClick={() => model.actions.setActiveTab(tab.key)}
              >
                <TabIcon size={14} aria-hidden="true" />
                <span className={styles.tabLabel}>{tab.label}</span>
              </button>
            )
          })}
        </div>
        {model.canScrollMobileRight ? (
          <div className={`${styles.mobileTabsFade} ${styles.mobileTabsFadeRight}`} aria-hidden="true">
            <span className={styles.mobileTabsCue}>›</span>
          </div>
        ) : null}
      </div>
    </div>
  )

  return (
    <SimpleLayout title="Settings">
      <AnimatedBackground />
      <StandardShell
        header={mobileHeader}
        headerVisibility="mobile"
        className={styles.settingsPageShell}
        contentAs="main"
        contentClassName={`${styles.container} ${styles.settingsPageContent}`}
      >
        <h1 className="sr-only">Settings</h1>
        <button type="button" className={styles.backBtn} onClick={model.navigation.goBack}>
          <ArrowLeft size={18} aria-hidden="true" />
          Back to Profiles
        </button>

        <div className={styles.mobileContentProfile}>
          <div className={styles.mobileContentProfileInner}>
            <span className={styles.mobileContentProfileLabel}>Profile</span>
            <SettingsProfileSelector
              currentProfileId={model.currentProfileId}
              onProfileChange={model.actions.handleProfileChange}
              onProfilesLoaded={model.actions.handleProfilesLoaded}
              label={null}
              compact
            />
          </div>
        </div>

        <div className={styles.settingsShell}>
          <aside className={styles.settingsSidebar} aria-label="Settings sections">
            <div className={styles.settingsSidebarTitle}>Settings</div>

            <div className={styles.sidebarProfileArea}>
              <SettingsProfileSelector
                currentProfileId={model.currentProfileId}
                onProfileChange={model.actions.handleProfileChange}
                onProfilesLoaded={model.actions.handleProfilesLoaded}
                label={null}
                layout="column"
                compact
              />
            </div>

            <div className={styles.settingsSidebarNav}>
              {model.tabItems.map((tab) => {
                const TabIcon = tab.icon
                const isActive = model.effectiveTab === tab.key
                return (
                  <button
                    key={tab.key}
                    type="button"
                    className={`${styles.sidebarTabBtn} ${isActive ? styles.sidebarTabBtnActive : ''}`}
                    aria-current={isActive ? 'page' : undefined}
                    onClick={() => model.actions.setActiveTab(tab.key)}
                  >
                    <TabIcon size={16} aria-hidden="true" />
                    <span>{tab.label}</span>
                  </button>
                )
              })}
            </div>
          </aside>

          <section className={styles.settingsContent}>
            {renderActiveSection(model)}
          </section>
        </div>
      </StandardShell>
    </SimpleLayout>
  )
}

export default SettingsPageStandardView
