import { SettingsProfileSelector } from '../components/features/SettingsProfileSelector'
import { AddonManager } from '../components/settings/AddonManager'
import { AppearanceSettings } from '../components/settings/AppearanceSettings'
import { DangerZoneSettings } from '../components/settings/DangerZoneSettings'
import { DownloadSettings } from '../components/settings/DownloadSettings'
import { GeneralSettings } from '../components/settings/GeneralSettings'
import { StreamingSettings } from '../components/settings/StreamingSettings'
import { TvFocusItem, TvFocusZone, TvPageScaffold } from '../components/tv'
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
  const activeTab = model.tabItems.find((item) => item.key === model.effectiveTab)

  return (
    <TvPageScaffold
      eyebrow="Settings"
      title="Settings"
      initialZoneId="settings-tabs"
      onBack={model.navigation.goBack}
      railMode="expanded"
      rail={(
        <TvFocusZone id="settings-tabs" orientation="vertical" nextRight="settings-content">
          {model.tabItems.map((tab, index) => {
            const Icon = tab.icon
            const isActive = model.effectiveTab === tab.key
            return (
              <TvFocusItem
                key={tab.key}
                id={`settings-tab-${tab.key}`}
                index={index}
                className={`${styles.railItem} ${isActive ? styles.railActive : ''}`}
                onActivate={() => model.actions.setActiveTab(tab.key)}
              >
                <span className={styles.railIcon}>
                  <Icon size={20} />
                </span>
                <span className={styles.railLabel}>{tab.label}</span>
              </TvFocusItem>
            )
          })}
        </TvFocusZone>
      )}
    >
      <TvFocusZone id="settings-content" orientation="vertical" nextLeft="settings-tabs">
        <div className={styles.page}>
          <div className={styles.profileRow}>
            <p className={styles.profileLabel}>Active Profile</p>
            <div className={styles.profileSelectorWrap}>
              <SettingsProfileSelector
                currentProfileId={model.currentProfileId}
                onProfileChange={model.actions.handleProfileChange}
                onProfilesLoaded={model.actions.handleProfilesLoaded}
                label={null}
                layout="column"
              />
            </div>
          </div>

          <div className={styles.sectionTitleRow}>
            <h2 className={styles.sectionTitle}>{activeTab?.label || 'Settings'}</h2>
          </div>

          <div className={styles.tvSettingsContent}>
            {renderTvSection(model)}
          </div>
        </div>
      </TvFocusZone>
    </TvPageScaffold>
  )
}

export default SettingsPageTvView
