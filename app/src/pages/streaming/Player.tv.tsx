import type { PlayerScreenModel } from './Player.model'
import { StreamingPlayerStandardView } from './Player.standard'

export function StreamingPlayerTvView(props: { model: PlayerScreenModel }) {
  return <StreamingPlayerStandardView {...props} />
}

export default StreamingPlayerTvView
