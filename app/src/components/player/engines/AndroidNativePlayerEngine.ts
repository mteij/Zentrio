/**
 * AndroidNativePlayerEngine
 *
 * IPlayerEngine implementation for all Android targets (TV and phone/tablet).
 * Delegates all playback to the native ExoPlayerPlugin via Tauri invoke/Channel.
 *
 * ExoPlayer renders in a hardware-accelerated fullscreen overlay on top of the
 * WebView, providing:
 *   - Native HLS and DASH support (handles debrid URLs without .m3u8 extension)
 *   - H.264, H.265/HEVC, VP9, AV1 hardware decoding
 *   - Dolby Digital / DTS audio pass-through
 *   - TV: D-pad-friendly controls; Phone: touch-friendly controls with subtitle button
 *
 * The <video> element passed to initialize() is intentionally unused. ExoPlayer
 * owns the video surface entirely. State updates (timeupdate, ended, error, tracks)
 * are received over a Tauri Channel so progress saving, Trakt scrobbling, and the
 * Watch Next launcher integration all continue to work.
 */

import { invoke, Channel } from '@tauri-apps/api/core'
import { getAppTarget } from '../../../lib/app-target'
import type {
  IPlayerEngine,
  PlayerState,
  PlayerEventHandlers,
  MediaSource,
  EngineCapabilities,
  SubtitleTrack,
  AudioTrack,
  QualityLevel,
  PlayerCloseReason,
} from './types'
import { createLogger } from '../../../utils/client-logger'

const log = createLogger('AndroidNativeEngine')

type ExoState = 'idle' | 'buffering' | 'ready' | 'playing' | 'paused' | 'ended'

interface ExoStateEvent {
  type: 'statechange'
  state: ExoState
  currentTimeMs: number
  durationMs: number
}

interface ExoTimeEvent {
  type: 'timeupdate'
  currentTimeMs: number
  durationMs: number
}

interface ExoErrorEvent {
  type: 'error'
  message: string
  code?: number
}

interface ExoTracksEvent {
  type: 'trackschanged'
  audioTracks: ExoTrack[]
  subtitleTracks: ExoTrack[]
}

interface ExoTrack {
  id: string
  groupIndex: number
  trackIndex: number
  language: string
  label: string
  channels?: number
  enabled: boolean
}

interface ExoBackEvent {
  type: 'back'
}

interface ExoVideoSizeEvent {
  type: 'videosize'
  width: number
  height: number
}

type ExoEvent =
  | ExoStateEvent
  | ExoTimeEvent
  | ExoErrorEvent
  | ExoTracksEvent
  | ExoBackEvent
  | ExoVideoSizeEvent

export function normalizeCloseReason(reason: unknown): PlayerCloseReason {
  return reason === 'back' ? 'back' : 'unknown'
}

export class AndroidNativePlayerEngine implements IPlayerEngine {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  private eventHandlers: Map<keyof PlayerEventHandlers, Set<Function>> = new Map()
  private _channel: Channel<ExoEvent> | null = null
  private audioTracks: AudioTrack[] = []
  private subtitleTracks: SubtitleTrack[] = []

  private state: PlayerState = {
    currentTime: 0,
    duration: 0,
    volume: 1,
    muted: false,
    playbackRate: 1,
    paused: true,
    buffering: false,
    ended: false,
    ready: false,
    buffered: null,
  }

  async initialize(_videoElement: HTMLVideoElement): Promise<void> {
    log.debug('AndroidNativePlayerEngine initialized (native ExoPlayer overlay)')
  }

  async loadSource(source: MediaSource): Promise<void> {
    this._channel = null

    log.debug('AndroidNativePlayerEngine: loading', source.src.substring(0, 80))

    this.state = {
      ...this.state,
      currentTime: 0,
      duration: 0,
      buffering: true,
      ended: false,
      ready: false,
      buffered: null,
    }
    this.emit('statechange', this.state)

    const ch = new Channel<ExoEvent>()
    this._channel = ch
    ch.onmessage = (event) => { this.handleEvent(event) }

    await invoke('exo_player_play', {
      args: {
        url: source.src,
        startPositionMs: 0,
        isTv: getAppTarget().isTv,
        onEvent: ch,
      },
    })
  }

  async destroy(): Promise<void> {
    log.debug('AndroidNativePlayerEngine: destroy')
    this._channel = null
    await invoke('exo_player_stop').catch(() => {})
    this.eventHandlers.clear()
  }

  async play(): Promise<void> {
    await invoke('exo_player_resume')
    this.state.paused = false
    this.emit('statechange', { paused: false })
  }

  pause(): void {
    invoke('exo_player_pause').catch((e) => log.error('pause:', e))
    this.state.paused = true
    this.emit('statechange', { paused: true })
  }

  async seek(time: number): Promise<void> {
    const positionMs = Math.round(Math.max(0, time) * 1000)
    await invoke('exo_player_seek', { args: { positionMs } })
    this.state.currentTime = time
    this.emit('statechange', { currentTime: time })
  }

  setVolume(volume: number): void {
    const v = Math.max(0, Math.min(1, volume))
    invoke('exo_player_set_volume', { args: { volume: v } }).catch((e) => log.error('setVolume:', e))
    this.state.volume = v
    this.emit('volumechange', v, this.state.muted)
  }

  setMuted(muted: boolean): void {
    invoke('exo_player_set_volume', { args: { volume: muted ? 0 : this.state.volume } })
      .catch((e) => log.error('setMuted:', e))
    this.state.muted = muted
    this.emit('volumechange', this.state.volume, muted)
  }

  setPlaybackRate(rate: number): void {
    const speed = Math.max(0.1, Math.min(4.0, rate))
    invoke('exo_player_set_playback_speed', { args: { speed } })
      .catch((e) => log.error('setPlaybackRate:', e))
    this.state.playbackRate = speed
    this.emit('statechange', { playbackRate: speed })
  }

  getState(): PlayerState {
    return { ...this.state }
  }

  getCapabilities(): EngineCapabilities {
    return {
      videoCodecs: ['h264', 'hevc', 'h265', 'vp9', 'av1'],
      audioCodecs: ['aac', 'mp3', 'opus', 'ac3', 'eac3', 'dts', 'truehd', 'flac', 'vorbis'],
      hls: true,
      dash: true,
      mse: false,
      canProbe: false,
    }
  }

  getSubtitleTracks(): SubtitleTrack[] {
    return [...this.subtitleTracks]
  }

  setSubtitleTrack(id: string | null): void {
    if (id === null) {
      invoke('exo_player_set_subtitle_track', { args: { groupIndex: -1, trackIndex: 0 } })
        .catch((e) => log.error('setSubtitleTrack:', e))
      return
    }

    const track = this.subtitleTracks.find((t) => t.id === id)
    if (!track) return

    const [groupIndex, trackIndex] = this.parseTrackId(id)
    invoke('exo_player_set_subtitle_track', { args: { groupIndex, trackIndex } })
      .catch((e) => log.error('setSubtitleTrack:', e))
  }

  addSubtitleTracks(_tracks: SubtitleTrack[]): void {
    log.debug('addSubtitleTracks: external sidecar subtitles deferred to v2')
  }

  getAudioTracks(): AudioTrack[] {
    return [...this.audioTracks]
  }

  setAudioTrack(id: string): void {
    const [groupIndex, trackIndex] = this.parseTrackId(id)
    invoke('exo_player_set_audio_track', { args: { groupIndex, trackIndex } })
      .catch((e) => log.error('setAudioTrack:', e))
  }

  getQualityLevels(): QualityLevel[] {
    return []
  }

  setQualityLevel(_id: string): void {}

  async canPlay(source: MediaSource): Promise<boolean> {
    return !!source.src
  }

  addEventListener<K extends keyof PlayerEventHandlers>(
    event: K,
    handler: PlayerEventHandlers[K]
  ): void {
    if (!this.eventHandlers.has(event)) this.eventHandlers.set(event, new Set())
    this.eventHandlers.get(event)!.add(handler)
  }

  removeEventListener<K extends keyof PlayerEventHandlers>(
    event: K,
    handler: PlayerEventHandlers[K]
  ): void {
    this.eventHandlers.get(event)?.delete(handler)
  }

  private handleEvent(event: ExoEvent): void {
    switch (event.type) {
      case 'statechange': {
        const currentTime = event.currentTimeMs / 1000
        const duration = event.durationMs > 0 ? event.durationMs / 1000 : this.state.duration

        this.state.currentTime = currentTime
        if (duration > 0) this.state.duration = duration

        switch (event.state) {
          case 'playing':
            this.state.buffering = false
            this.state.paused = false
            this.state.ready = true
            this.emit('playing')
            this.emit('statechange', { paused: false, buffering: false, ready: true })
            break
          case 'paused':
            this.state.paused = true
            this.emit('statechange', { paused: true })
            break
          case 'buffering':
            this.state.buffering = true
            this.emit('waiting')
            this.emit('statechange', { buffering: true })
            break
          case 'ready':
            this.state.ready = true
            this.state.buffering = false
            this.emit('canplay')
            this.emit('statechange', { ready: true, buffering: false })
            if (duration > 0) this.emit('loadedmetadata', duration)
            break
          case 'ended':
            this.state.ended = true
            this.state.paused = true
            this.emit('ended')
            this.emit('statechange', { ended: true, paused: true })
            break
        }
        break
      }

      case 'timeupdate': {
        const currentTime = event.currentTimeMs / 1000
        const duration = event.durationMs > 0 ? event.durationMs / 1000 : this.state.duration
        this.state.currentTime = currentTime
        if (duration > 0 && this.state.duration !== duration) {
          this.state.duration = duration
          this.emit('loadedmetadata', duration)
        }
        this.emit('timeupdate', currentTime, this.state.duration)
        break
      }

      case 'error': {
        const err = new Error(
          `ExoPlayer error${event.code != null ? ` ${event.code}` : ''}: ${event.message}`
        )
        log.error('ExoPlayer error:', err.message)
        this.emit('error', err)
        break
      }

      case 'trackschanged': {
        this.audioTracks = event.audioTracks.map((t) => ({
          id: t.id,
          label: t.label,
          language: t.language,
          enabled: t.enabled,
        }))
        this.subtitleTracks = event.subtitleTracks.map((t) => ({
          id: t.id,
          src: '',
          label: t.label,
          language: t.language,
          enabled: t.enabled,
          kind: 'subtitles' as const,
        }))
        this.emit('audiotrackschange', this.audioTracks)
        this.emit('subtitletrackschange', this.subtitleTracks)
        break
      }

      case 'back':
        this.state.paused = true
        this.state.buffering = false
        this.state.ready = false
        this.emit('close', 'back')
        this.emit('statechange', { paused: true, buffering: false, ready: false })
        break

      case 'videosize':
        break
    }
  }

  private parseTrackId(id: string): [number, number] {
    const parts = id.split('_')
    return [parseInt(parts[0] ?? '0', 10), parseInt(parts[1] ?? '0', 10)]
  }

  private emit<K extends keyof PlayerEventHandlers>(
    event: K,
    ...args: Parameters<PlayerEventHandlers[K]>
  ): void {
    const handlers = this.eventHandlers.get(event)
    if (!handlers) return

    handlers.forEach((handler) => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
        (handler as Function)(...args)
      } catch (error) {
        log.error(`Error in ${event} handler:`, error)
      }
    })
  }
}

export default AndroidNativePlayerEngine
