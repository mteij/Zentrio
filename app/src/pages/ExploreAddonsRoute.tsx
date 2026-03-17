import { AdaptiveScreen } from '../components/tv'
import { useExploreAddonsScreenModel } from './ExploreAddonsPage.model'
import { ExploreAddonsPageStandardView } from './ExploreAddonsPage.standard'
import { ExploreAddonsPageTvView } from './ExploreAddonsPage.tv'

export function ExploreAddonsRoute() {
  const model = useExploreAddonsScreenModel()

  return (
    <AdaptiveScreen
      model={model}
      StandardView={ExploreAddonsPageStandardView}
      TvView={ExploreAddonsPageTvView}
    />
  )
}

export default ExploreAddonsRoute
