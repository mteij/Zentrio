import type { LibraryScreenModel } from './Library.model'
import { StreamingLibrary as LegacyStreamingLibrary } from './Library'

export function StreamingLibraryStandardView(_props: { model: LibraryScreenModel }) {
  return <LegacyStreamingLibrary />
}

export default StreamingLibraryStandardView
