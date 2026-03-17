package com.zentrio.mteij

import android.app.Activity
import android.graphics.Color
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.view.ViewGroup
import android.widget.FrameLayout
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.PlaybackParameters
import androidx.media3.common.Player
import androidx.media3.common.Tracks
import androidx.media3.common.VideoSize
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.DefaultRenderersFactory
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.trackselection.DefaultTrackSelector
import androidx.media3.ui.PlayerView
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Channel
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSArray
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin

// ─── Arg classes ──────────────────────────────────────────────────────────────

@InvokeArg
internal class ExoPlayArgs {
    var url: String = ""
    var startPositionMs: Long = 0
    var isTv: Boolean = false
    var onEvent: Channel? = null
}

@InvokeArg
internal class ExoSeekArgs {
    var positionMs: Long = 0
}

@InvokeArg
internal class ExoVolumeArgs {
    var volume: Float = 1.0f
}

@InvokeArg
internal class ExoSpeedArgs {
    var speed: Float = 1.0f
}

@InvokeArg
internal class ExoSetTrackArgs {
    var groupIndex: Int = -1
    var trackIndex: Int = 0
}

// ─── Plugin ───────────────────────────────────────────────────────────────────

@OptIn(UnstableApi::class)
@TauriPlugin
class ExoPlayerPlugin(private val activity: Activity) : Plugin(activity) {

    private val mainHandler = Handler(Looper.getMainLooper())

    // Active session
    private var player: ExoPlayer? = null
    private var playerView: PlayerView? = null
    private var overlayLayout: FrameLayout? = null
    private var eventChannel: Channel? = null
    private var progressRunnable: Runnable? = null
    private var backCallback: OnBackPressedCallback? = null

    // ─── Commands ─────────────────────────────────────────────────────────────

    @Command
    fun play(invoke: Invoke) {
        val args = invoke.parseArgs(ExoPlayArgs::class.java)
        if (args.url.isBlank()) {
            invoke.reject("url is required")
            return
        }

        mainHandler.post {
            teardownPlayer()

            eventChannel = args.onEvent

            // Renderer factory with decoder fallback — when a codec exceeds its
            // capabilities (e.g. software HEVC on emulator vs 4K content) ExoPlayer
            // automatically retries with the next available decoder instead of erroring.
            val renderersFactory = DefaultRenderersFactory(activity).apply {
                setExtensionRendererMode(DefaultRenderersFactory.EXTENSION_RENDERER_MODE_PREFER)
                setEnableDecoderFallback(true)
            }

            // Track selector: allow adapting across decoders of mixed capability so
            // ExoPlayer can fall back gracefully when one decoder can't handle the stream.
            val trackSelector = DefaultTrackSelector(activity).apply {
                setParameters(
                    buildUponParameters()
                        .setAllowVideoMixedMimeTypeAdaptiveness(true)
                        .setAllowVideoNonSeamlessAdaptiveness(true)
                        .setAllowAudioMixedMimeTypeAdaptiveness(true)
                        .setAllowAudioMixedChannelCountAdaptiveness(true)
                        .build()
                )
            }

            // Build ExoPlayer
            val exoPlayer = ExoPlayer.Builder(activity, renderersFactory)
                .setTrackSelector(trackSelector)
                .build()
            player = exoPlayer

            val mediaItem = MediaItem.fromUri(Uri.parse(args.url))
            exoPlayer.setMediaItem(mediaItem)

            if (args.startPositionMs > 0) {
                exoPlayer.seekTo(args.startPositionMs)
            }

            // Build fullscreen overlay
            val overlay = FrameLayout(activity).apply {
                layoutParams = FrameLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT
                )
                setBackgroundColor(Color.BLACK)
                elevation = 9999f
                keepScreenOn = true  // prevent screen timeout during playback
            }
            overlayLayout = overlay

            // PlayerView — controls differ between TV (D-pad) and phone (touch)
            val pv = PlayerView(activity).apply {
                layoutParams = FrameLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT
                )
                useController = true
                setShowNextButton(false)
                setShowPreviousButton(false)
                setShowFastForwardButton(true)
                setShowRewindButton(true)
                if (!args.isTv) {
                    // Phone/tablet: show subtitle and settings buttons for touch access
                    setShowSubtitleButton(true)
                    setShowShuffleButton(false)
                }
                player = exoPlayer
            }
            playerView = pv
            overlay.addView(pv)

            // Attach overlay to the activity root
            val root = activity.window.decorView.rootView as? ViewGroup
                ?: activity.findViewById(android.R.id.content)
            root.addView(overlay)

            // Re-apply immersive mode so status bar stays hidden over the player
            ImmersiveModeState.apply(activity)

            // Back key closes the player and tells JS to navigate back
            val backCb = object : OnBackPressedCallback(true) {
                override fun handleOnBackPressed() {
                    sendEvent(JSObject().put("type", "back"))
                    teardownPlayer()
                }
            }
            backCallback = backCb
            (activity as? ComponentActivity)
                ?.onBackPressedDispatcher?.addCallback(backCb)

            // ExoPlayer listener
            exoPlayer.addListener(object : Player.Listener {

                override fun onPlaybackStateChanged(playbackState: Int) {
                    when (playbackState) {
                        Player.STATE_BUFFERING -> sendStateEvent("buffering", exoPlayer)
                        Player.STATE_READY -> {
                            val state = if (exoPlayer.isPlaying) "playing" else "ready"
                            sendStateEvent(state, exoPlayer)
                        }
                        Player.STATE_ENDED -> {
                            stopProgressTimer()
                            sendStateEvent("ended", exoPlayer)
                        }
                        Player.STATE_IDLE -> {
                            stopProgressTimer()
                        }
                    }
                }

                override fun onIsPlayingChanged(isPlaying: Boolean) {
                    if (isPlaying) {
                        sendStateEvent("playing", exoPlayer)
                        startProgressTimer(exoPlayer)
                    } else {
                        stopProgressTimer()
                        if (exoPlayer.playbackState != Player.STATE_ENDED) {
                            sendStateEvent("paused", exoPlayer)
                        }
                    }
                }

                // Emit tracks whenever the track list changes — covers initial load,
                // mid-stream track switches, and adaptive quality changes.
                override fun onTracksChanged(tracks: Tracks) {
                    sendTracksChanged(tracks)
                }

                override fun onPlayerError(error: PlaybackException) {
                    stopProgressTimer()
                    sendEvent(
                        JSObject()
                            .put("type", "error")
                            .put("message", error.message ?: "Playback error")
                            .put("code", error.errorCode)
                    )
                }

                override fun onVideoSizeChanged(videoSize: VideoSize) {
                    sendEvent(
                        JSObject()
                            .put("type", "videosize")
                            .put("width", videoSize.width)
                            .put("height", videoSize.height)
                    )
                }
            })

            exoPlayer.prepare()
            exoPlayer.playWhenReady = true

            invoke.resolve(JSObject().put("ok", true))
        }
    }

    @Command
    fun pause(invoke: Invoke) {
        mainHandler.post {
            player?.pause()
            invoke.resolve()
        }
    }

    @Command
    fun resume(invoke: Invoke) {
        mainHandler.post {
            player?.play()
            invoke.resolve()
        }
    }

    @Command
    fun seek(invoke: Invoke) {
        val args = invoke.parseArgs(ExoSeekArgs::class.java)
        mainHandler.post {
            player?.seekTo(args.positionMs)
            invoke.resolve()
        }
    }

    @Command
    fun stop(invoke: Invoke) {
        mainHandler.post {
            teardownPlayer()
            invoke.resolve()
        }
    }

    @Command
    fun setVolume(invoke: Invoke) {
        val args = invoke.parseArgs(ExoVolumeArgs::class.java)
        mainHandler.post {
            player?.volume = args.volume.coerceIn(0f, 1f)
            invoke.resolve()
        }
    }

    @Command
    fun setPlaybackSpeed(invoke: Invoke) {
        val args = invoke.parseArgs(ExoSpeedArgs::class.java)
        mainHandler.post {
            val speed = args.speed.coerceIn(0.1f, 4.0f)
            player?.playbackParameters = PlaybackParameters(speed)
            invoke.resolve()
        }
    }

    /** Select an audio track by group+track index reported in the trackschanged event. */
    @Command
    fun setAudioTrack(invoke: Invoke) {
        val args = invoke.parseArgs(ExoSetTrackArgs::class.java)
        mainHandler.post {
            val p = player
            if (p == null) { invoke.reject("no active player"); return@post }
            val groups = p.currentTracks.groups
            if (args.groupIndex < 0 || args.groupIndex >= groups.size) {
                invoke.reject("invalid groupIndex")
                return@post
            }
            p.trackSelectionParameters = p.trackSelectionParameters.buildUpon()
                .setOverrideForType(
                    androidx.media3.common.TrackSelectionOverride(
                        groups[args.groupIndex].mediaTrackGroup,
                        args.trackIndex
                    )
                )
                .build()
            invoke.resolve()
        }
    }

    /** Select a subtitle track by group+track index, or pass groupIndex=-1 to disable. */
    @Command
    fun setSubtitleTrack(invoke: Invoke) {
        val args = invoke.parseArgs(ExoSetTrackArgs::class.java)
        mainHandler.post {
            val p = player
            if (p == null) { invoke.reject("no active player"); return@post }
            if (args.groupIndex < 0) {
                // Disable all subtitles
                p.trackSelectionParameters = p.trackSelectionParameters.buildUpon()
                    .setTrackTypeDisabled(C.TRACK_TYPE_TEXT, true)
                    .build()
            } else {
                val groups = p.currentTracks.groups
                if (args.groupIndex >= groups.size) { invoke.reject("invalid groupIndex"); return@post }
                p.trackSelectionParameters = p.trackSelectionParameters.buildUpon()
                    .setTrackTypeDisabled(C.TRACK_TYPE_TEXT, false)
                    .setOverrideForType(
                        androidx.media3.common.TrackSelectionOverride(
                            groups[args.groupIndex].mediaTrackGroup,
                            args.trackIndex
                        )
                    )
                    .build()
            }
            invoke.resolve()
        }
    }

    @Command
    fun getState(invoke: Invoke) {
        mainHandler.post {
            val p = player
            if (p == null) {
                invoke.resolve(JSObject().put("active", false))
                return@post
            }
            val stateStr = when {
                p.playbackState == Player.STATE_ENDED -> "ended"
                p.playbackState == Player.STATE_BUFFERING -> "buffering"
                p.isPlaying -> "playing"
                p.playbackState == Player.STATE_READY -> "paused"
                else -> "idle"
            }
            invoke.resolve(
                JSObject()
                    .put("active", true)
                    .put("state", stateStr)
                    .put("currentTimeMs", p.currentPosition)
                    .put("durationMs", if (p.duration > 0) p.duration else 0)
                    .put("volume", p.volume)
                    .put("speed", p.playbackParameters.speed)
            )
        }
    }

    // ─── Private helpers ──────────────────────────────────────────────────────

    private fun sendEvent(payload: JSObject) {
        eventChannel?.send(payload)
    }

    private fun sendStateEvent(state: String, p: ExoPlayer) {
        sendEvent(
            JSObject()
                .put("type", "statechange")
                .put("state", state)
                .put("currentTimeMs", p.currentPosition)
                .put("durationMs", if (p.duration > 0) p.duration else 0)
        )
    }

    private fun sendTracksChanged(tracks: Tracks) {
        val audioTracks = JSArray()
        val subtitleTracks = JSArray()

        for ((groupIndex, group) in tracks.groups.withIndex()) {
            for (trackIndex in 0 until group.length) {
                val format = group.getTrackFormat(trackIndex)
                val isSelected = group.isTrackSelected(trackIndex)

                // Build a human-readable label: prefer explicit label, then language +
                // codec hint + bitrate so users can distinguish tracks in the UI.
                fun buildLabel(fallback: String): String {
                    if (!format.label.isNullOrBlank()) return format.label!!
                    val lang = format.language?.takeIf { it.isNotBlank() } ?: fallback
                    val codec = format.codecs?.substringBefore(".")?.takeIf { it.isNotBlank() }
                    val kbps = if (format.bitrate > 0) "${format.bitrate / 1000}kbps" else null
                    val detail = listOfNotNull(codec, kbps).joinToString(", ")
                    return if (detail.isNotEmpty()) "$lang ($detail)" else lang
                }

                when (group.type) {
                    C.TRACK_TYPE_AUDIO -> audioTracks.put(
                        JSObject()
                            .put("id", "${groupIndex}_${trackIndex}")
                            .put("groupIndex", groupIndex)
                            .put("trackIndex", trackIndex)
                            .put("language", format.language ?: "und")
                            .put("label", buildLabel("Audio $trackIndex"))
                            .put("channels", format.channelCount)
                            .put("enabled", isSelected)
                    )
                    C.TRACK_TYPE_TEXT -> subtitleTracks.put(
                        JSObject()
                            .put("id", "${groupIndex}_${trackIndex}")
                            .put("groupIndex", groupIndex)
                            .put("trackIndex", trackIndex)
                            .put("language", format.language ?: "und")
                            .put("label", buildLabel("Sub $trackIndex"))
                            .put("enabled", isSelected)
                    )
                }
            }
        }

        sendEvent(
            JSObject()
                .put("type", "trackschanged")
                .put("audioTracks", audioTracks)
                .put("subtitleTracks", subtitleTracks)
        )
    }

    private fun startProgressTimer(p: ExoPlayer) {
        stopProgressTimer()
        val r = object : Runnable {
            override fun run() {
                if (p.isPlaying) {
                    sendEvent(
                        JSObject()
                            .put("type", "timeupdate")
                            .put("currentTimeMs", p.currentPosition)
                            .put("durationMs", if (p.duration > 0) p.duration else 0)
                    )
                    mainHandler.postDelayed(this, 500)
                }
            }
        }
        progressRunnable = r
        mainHandler.postDelayed(r, 500)
    }

    private fun stopProgressTimer() {
        progressRunnable?.let { mainHandler.removeCallbacks(it) }
        progressRunnable = null
    }

    private fun teardownPlayer() {
        stopProgressTimer()

        backCallback?.remove()
        backCallback = null

        player?.release()
        player = null

        playerView?.player = null
        playerView = null

        overlayLayout?.let { v ->
            (v.parent as? ViewGroup)?.removeView(v)
        }
        overlayLayout = null

        eventChannel = null
    }
}
