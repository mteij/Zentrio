import type { PlayerScreenModel } from './Player.model'
import { StreamingPlayer as LegacyStreamingPlayer } from './Player'

export function StreamingPlayerStandardView(_props: { model: PlayerScreenModel }) {
  return <LegacyStreamingPlayer />
}

export default StreamingPlayerStandardView
