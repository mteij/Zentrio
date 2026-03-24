import { AdaptiveScreen } from '../../components/tv'
import { StreamingExploreStandardView } from './Explore.standard'
import { useExploreScreenModel } from './Explore.model'
import { StreamingExploreTvView } from './Explore.tv'

export function StreamingExploreRoute() {
  const model = useExploreScreenModel()

  return (
    <AdaptiveScreen
      model={model}
      StandardView={StreamingExploreStandardView}
      TvView={StreamingExploreTvView}
    />
  )
}

export default StreamingExploreRoute
