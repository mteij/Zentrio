import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { AnimatedBackground, SimpleLayout, StandardShell, StandardTopBar } from '../components'
import { SettingsProfileSelector } from '../components/features/SettingsProfileSelector'
import { SettingsTabContent } from '../components/settings/SettingsTabContent'
import type { SettingsTabKey } from '../components/settings/settingsSchema'
import type { SettingsScreenModel } from './SettingsPage.model'
import styles from '../styles/Settings.module.css'

const TAB_LABELS: Record<SettingsTabKey, string> = {
  general: 'General',
  appearance: 'Appearance',
  addons: 'Addons',
  streaming: 'Streaming',
  downloads: 'Downloads',
  danger: 'Danger Zone',
}

export function SettingsPageStandardView({ model }: { model: SettingsScreenModel }) {
  const [openOverlaySection, setOpenOverlaySection] = useState<string | undefined>()
  const activeTabLabel = TAB_LABELS[model.effectiveTab] ?? 'Settings'
  const activeTabIndex = model.tabItems.findIndex((t) => t.key === model.effectiveTab)
  const canGoPrev = activeTabIndex > 0
  const canGoNext = activeTabIndex < model.tabItems.length - 1

  const goToPrev = () => {
    const prev = model.tabItems[activeTabIndex - 1]
    if (prev) model.actions.setActiveTab(prev.key)
  }

  const goToNext = () => {
    const next = model.tabItems[activeTabIndex + 1]
    if (next) model.actions.setActiveTab(next.key)
  }

  const mobileHeader = (
    <div className={styles.mobileHeader}>
      <StandardTopBar
        title={activeTabLabel}
        hideTitleGroup={false}
        className={styles.mobileHeaderBar}
        leftSlot={
          <button
            type="button"
            className={styles.mobileBackBtn}
            onClick={model.navigation.goBack}
            aria-label="Back to Profiles"
          >
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
        }
        rightSlot={
          <div className={styles.mobileHeaderProfile}>
            <SettingsProfileSelector
              currentProfileId={model.currentProfileId}
              onProfileChange={model.actions.handleProfileChange}
              onProfilesLoaded={model.actions.handleProfilesLoaded}
              label={null}
              compact
              mode="switcher"
              theme="mobile-header"
            />
          </div>
        }
      />
      <div className={styles.mobileSectionNav}>
        <button
          type="button"
          className={styles.mobileNavBtn}
          onClick={goToPrev}
          disabled={!canGoPrev}
          aria-label="Previous section"
        >
          <ChevronLeft size={16} aria-hidden="true" />
        </button>
        <div className={styles.mobileNavTabs} role="tablist">
          {model.tabItems.map((tab) => {
            const isActive = model.effectiveTab === tab.key
            const TabIcon = tab.icon
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-label={TAB_LABELS[tab.key]}
                className={`${styles.mobileNavTab} ${isActive ? styles.mobileNavTabActive : ''}`}
                onClick={() => model.actions.setActiveTab(tab.key)}
              >
                <TabIcon size={14} aria-hidden="true" />
              </button>
            )
          })}
        </div>
        <button
          type="button"
          className={styles.mobileNavBtn}
          onClick={goToNext}
          disabled={!canGoNext}
          aria-label="Next section"
        >
          <ChevronRight size={16} aria-hidden="true" />
        </button>
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
        <h1 className="sr-only">Settings — {activeTabLabel}</h1>

        <div className={styles.mobileSettingsLayout}>
          <button type="button" className={styles.backBtn} onClick={model.navigation.goBack}>
            <ChevronLeft size={18} aria-hidden="true" />
            Back to Profiles
          </button>

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
                  mode="switcher"
                />
              </div>

              <nav className={styles.settingsSidebarNav} aria-label="Settings tabs">
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
                      <span>{TAB_LABELS[tab.key] ?? tab.label}</span>
                    </button>
                  )
                })}
              </nav>
            </aside>

            <section className={styles.settingsContent} aria-label={activeTabLabel}>
              <SettingsTabContent
                model={model}
                platform="standard"
                openOverlaySection={openOverlaySection}
                onOpenOverlay={setOpenOverlaySection}
                onCloseOverlay={() => setOpenOverlaySection(undefined)}
              />
            </section>
          </div>
        </div>
      </StandardShell>
    </SimpleLayout>
  )
}

export default SettingsPageStandardView
