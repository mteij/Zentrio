import { AdaptiveScreen } from '../components/tv'
import { useSettingsScreenModel } from './SettingsPage.model'
import { SettingsPageStandardView } from './SettingsPage.standard'
import { SettingsPageTvView } from './SettingsPage.tv'

export function SettingsPage() {
  const model = useSettingsScreenModel()

  return (
    <AdaptiveScreen
      model={model}
      StandardView={SettingsPageStandardView}
      TvView={SettingsPageTvView}
    />
  )
}

export default SettingsPage
