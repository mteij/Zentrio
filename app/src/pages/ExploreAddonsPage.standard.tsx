import type { ExploreAddonsScreenModel } from './ExploreAddonsPage.model'
import { ExploreAddonsPage as LegacyExploreAddonsPage } from './ExploreAddonsPage'

export function ExploreAddonsPageStandardView(_props: { model: ExploreAddonsScreenModel }) {
  return <LegacyExploreAddonsPage />
}

export default ExploreAddonsPageStandardView
