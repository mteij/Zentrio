import type { DetailsScreenModel } from './Details.model'
import { StreamingDetails as LegacyStreamingDetails } from './Details'

export function StreamingDetailsStandardView(_props: { model: DetailsScreenModel }) {
  return <LegacyStreamingDetails />
}

export default StreamingDetailsStandardView
