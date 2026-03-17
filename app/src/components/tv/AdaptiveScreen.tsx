import type { ComponentType } from 'react'
import { getPlatformCapabilities } from '../../lib/platform-capabilities'

export interface AdaptiveScreenProps<TModel> {
  model: TModel
  StandardView: ComponentType<{ model: TModel }>
  TvView: ComponentType<{ model: TModel }>
  isTv?: boolean
}

export function AdaptiveScreen<TModel>({
  model,
  StandardView,
  TvView,
  isTv = getPlatformCapabilities().canUseRemoteNavigation,
}: AdaptiveScreenProps<TModel>) {
  if (isTv) {
    return <TvView model={model} />
  }

  return <StandardView model={model} />
}

export default AdaptiveScreen
