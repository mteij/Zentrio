import { AdaptiveScreen } from '../../components/tv'
import { useSearchScreenModel } from './Search.model'
import { StreamingSearchStandardView } from './Search.standard'
import { StreamingSearchTvView } from './Search.tv'

export const StreamingSearch = () => {
  const model = useSearchScreenModel()

  return (
    <AdaptiveScreen
      model={model}
      StandardView={StreamingSearchStandardView}
      TvView={StreamingSearchTvView}
    />
  )
}

export default StreamingSearch
