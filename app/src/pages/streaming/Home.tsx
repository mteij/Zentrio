import { AdaptiveScreen } from '../../components/tv'
import { useHomeScreenModel } from './Home.model'
import { StreamingHomeStandardView } from './Home.standard'
import { StreamingHomeTvView } from './Home.tv'

export const StreamingHome = () => {
  const model = useHomeScreenModel()

  return (
    <AdaptiveScreen
      model={model}
      StandardView={StreamingHomeStandardView}
      TvView={StreamingHomeTvView}
    />
  )
}

export default StreamingHome
