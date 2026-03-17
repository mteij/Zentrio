import { AdaptiveScreen } from '../components/tv'
import { useProfilesScreenModel } from './ProfilesPage.model'
import { ProfilesPageStandardView } from './ProfilesPage.standard'
import { ProfilesPageTvView } from './ProfilesPage.tv'

interface ProfilesPageProps {
  user?: any
}

export function ProfilesPage(_props: ProfilesPageProps) {
  const model = useProfilesScreenModel()

  return (
    <AdaptiveScreen
      model={model}
      StandardView={ProfilesPageStandardView}
      TvView={ProfilesPageTvView}
    />
  )
}

export default ProfilesPage
