import { SettingsProfileSelector } from '../components/features/SettingsProfileSelector'
import { AddonManager } from '../components/settings/AddonManager'
import { AppearanceSettings } from '../components/settings/AppearanceSettings'
import { DangerZoneSettings } from '../components/settings/DangerZoneSettings'
import { DownloadSettings } from '../components/settings/DownloadSettings'
import { GeneralSettings } from '../components/settings/GeneralSettings'
import { StreamingSettings } from '../components/settings/StreamingSettings'
import { TvFocusZone, TvPageScaffold, TvRailMenu } from '../components/tv'
import type { SettingsScreenModel } from './SettingsPage.model'
import styles from './SettingsPage.tv.module.css'

function renderTvSection(model: SettingsScreenModel) {
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
  if (model.effectiveTab === 'downloads') return <DownloadSettings currentProfileId={model.currentProfileId} />
  if (model.effectiveTab === 'danger') return <DangerZoneSettings />
  return <GeneralSettings />
}

export function SettingsPageTvView({ model }: { model: SettingsScreenModel }) {
  return (
    <TvPageScaffold
      title="Settings"
      initialZoneId="settings-tabs"
      onBack={model.navigation.goBack}
      hideHeader
      railMode="adaptive"
      railHeaderAction={(
        <div className={styles.railProfileState} aria-label={`Active settings profile: ${model.currentProfileName}`}>
          <span className={styles.railProfileLabel}>Editing</span>
          <span className={styles.railProfileValue}>{model.currentProfileName}</span>
        </div>
      )}
      rail={(
        <TvRailMenu
          zoneId="settings-tabs"
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
          <div className={styles.tvSettingsContent}>
            {renderTvSection(model)}
          </div>

          <div className={styles.profileRow}>
            <p className={styles.profileLabel}>Settings Profile</p>
            <div className={styles.profileSelectorWrap}>
              <SettingsProfileSelector
                currentProfileId={model.currentProfileId}
                onProfileChange={model.actions.handleProfileChange}
                onProfilesLoaded={model.actions.handleProfilesLoaded}
                label={null}
                layout="row"
                compact
              />
            </div>
          </div>
        </div>
      </TvFocusZone>
    </TvPageScaffold>
  )
}

export default SettingsPageTvView
