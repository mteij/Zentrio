import { AdaptiveScreen } from '../../components/tv'
import { useSeriesDownloadsScreenModel } from './SeriesDownloadsPage.model'
import { SeriesDownloadsStandardView } from './SeriesDownloadsPage.standard'
import { SeriesDownloadsTvView } from './SeriesDownloadsPage.tv'

export function SeriesDownloadsPage() {
  const model = useSeriesDownloadsScreenModel()

  return (
    <AdaptiveScreen
      model={model}
      StandardView={SeriesDownloadsStandardView}
      TvView={SeriesDownloadsTvView}
    />
  )
}

export default SeriesDownloadsPage
