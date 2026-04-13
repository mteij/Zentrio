import { useState } from 'react'
import { SettingsTabContent } from '../components/settings/SettingsTabContent'
import { TvSettingsProfileSwitcher } from '../components/settings/TvSettingsProfileSwitcher'
import { TvFocusZone, TvPageScaffold, TvRailMenu } from '../components/tv'
import type { SettingsScreenModel } from './SettingsPage.model'
import styles from './SettingsPage.tv.module.css'

export function SettingsPageTvView({ model }: { model: SettingsScreenModel }) {
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false)
  const [profileMenuCloseSignal, setProfileMenuCloseSignal] = useState(0)
  const activeTab = model.tabItems.find((tab) => tab.key === model.effectiveTab) ?? model.tabItems[0]

  return (
    <TvPageScaffold
      title="Settings"
      initialZoneId="settings-tabs"
      onBack={() => {
        if (isProfileMenuOpen) {
          setProfileMenuCloseSignal((value) => value + 1)
          return
        }
        model.navigation.goBack()
      }}
      hideHeader
      hideRailIdentity
      railMode="adaptive"
      railHeaderAction={(
        <div className={styles.railProfileControl}>
          <TvSettingsProfileSwitcher
            zoneId="settings-profile"
            currentProfileId={model.currentProfileId}
            currentProfileName={model.currentProfileName}
            onProfileChange={model.actions.handleProfileChange}
            onProfilesLoaded={model.actions.handleProfilesLoaded}
            onMenuOpenChange={setIsProfileMenuOpen}
            requestCloseSignal={profileMenuCloseSignal}
            nextDown="settings-tabs"
            nextRight="settings-content"
          />
        </div>
      )}
      rail={(
        <TvRailMenu
          zoneId="settings-tabs"
          nextUp="settings-profile"
          nextRight="settings-content"
          items={model.tabItems.map((tab) => ({
            id: tab.key,
            label: tab.label,
            icon: tab.icon,
            active: model.effectiveTab === tab.key,
            onActivate: () => model.actions.setActiveTab(tab.key),
          }))}
        />
      )}
    >
      <TvFocusZone id="settings-content" orientation="vertical" nextLeft="settings-tabs">
        <div className={styles.page}>
          <header className={styles.pageHeader}>
            <div className={styles.pageEyebrow}>Settings</div>
            <div className={styles.pageTitleRow}>
              <h1 className={styles.pageTitle}>{activeTab?.label ?? 'Settings'}</h1>
              <div className={styles.pageProfile}>{model.currentProfileName}</div>
            </div>
          </header>
          <div className={styles.tvSettingsContent}>
            <SettingsTabContent model={model} platform="tv" />
          </div>
        </div>
      </TvFocusZone>
    </TvPageScaffold>
  )
}

export default SettingsPageTvView
