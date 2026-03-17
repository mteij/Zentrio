import { AdaptiveScreen } from '../../components/tv'
import { useCatalogScreenModel } from './Catalog.model'
import { StreamingCatalogStandardView } from './Catalog.standard'
import { StreamingCatalogTvView } from './Catalog.tv'

export const StreamingCatalog = () => {
  const model = useCatalogScreenModel()

  return (
    <AdaptiveScreen
      model={model}
      StandardView={StreamingCatalogStandardView}
      TvView={StreamingCatalogTvView}
    />
  )
}

export default StreamingCatalog
