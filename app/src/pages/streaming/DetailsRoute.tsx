import { AdaptiveScreen } from '../../components/tv'
import { useDetailsScreenModel } from './Details.model'
import { StreamingDetailsStandardView } from './Details.standard'
import { StreamingDetailsTvView } from './Details.tv'

export function StreamingDetailsRoute() {
  const model = useDetailsScreenModel()

  return (
    <AdaptiveScreen
      model={model}
      StandardView={StreamingDetailsStandardView}
      TvView={StreamingDetailsTvView}
    />
  )
}

export default StreamingDetailsRoute
