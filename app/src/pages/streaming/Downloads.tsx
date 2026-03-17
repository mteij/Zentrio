import { AdaptiveScreen } from '../../components/tv'
import { useDownloadsScreenModel } from './Downloads.model'
import { StreamingDownloadsStandardView } from './Downloads.standard'
import { StreamingDownloadsTvView } from './Downloads.tv'

export function StreamingDownloads() {
  const model = useDownloadsScreenModel()

  return (
    <AdaptiveScreen
      model={model}
      StandardView={StreamingDownloadsStandardView}
      TvView={StreamingDownloadsTvView}
    />
  )
}

export default StreamingDownloads
