import { AdaptiveScreen } from '../../components/tv'
import { useLibraryScreenModel } from './Library.model'
import { StreamingLibraryStandardView } from './Library.standard'
import { StreamingLibraryTvView } from './Library.tv'

export function StreamingLibraryRoute() {
  const model = useLibraryScreenModel()

  return (
    <AdaptiveScreen
      model={model}
      StandardView={StreamingLibraryStandardView}
      TvView={StreamingLibraryTvView}
    />
  )
}

export default StreamingLibraryRoute
