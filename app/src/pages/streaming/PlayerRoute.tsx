import { AdaptiveScreen } from '../../components/tv'
import { usePlayerScreenModel } from './Player.model'
import { StreamingPlayerStandardView } from './Player.standard'
import { StreamingPlayerTvView } from './Player.tv'

export function StreamingPlayerRoute() {
  const model = usePlayerScreenModel()

  return (
    <AdaptiveScreen
      model={model}
      StandardView={StreamingPlayerStandardView}
      TvView={StreamingPlayerTvView}
    />
  )
}

export default StreamingPlayerRoute
