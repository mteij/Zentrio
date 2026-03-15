package com.zentrio.mteij

import android.app.Activity
import android.content.pm.ActivityInfo
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.Plugin

@InvokeArg
internal class SetImmersiveModeArgs {
  var enabled: Boolean = false
}

@InvokeArg
internal class SetOrientationArgs {
  var orientation: String = "auto"
}

@InvokeArg
internal class SetPlayerModeArgs {
  var enabled: Boolean = false
  var orientation: String = "auto"
}

internal object ImmersiveModeState {
  var immersiveEnabled: Boolean = false
  var requestedOrientation: Int = ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED

  fun apply(activity: Activity) {
    activity.requestedOrientation = requestedOrientation

    WindowCompat.setDecorFitsSystemWindows(activity.window, !immersiveEnabled)
    val controller = WindowCompat.getInsetsController(activity.window, activity.window.decorView)
    controller.systemBarsBehavior =
      WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE

    if (immersiveEnabled) {
      controller.hide(WindowInsetsCompat.Type.systemBars())
    } else {
      controller.show(WindowInsetsCompat.Type.systemBars())
    }
  }
}

@TauriPlugin
class ImmersiveModePlugin(private val activity: Activity) : Plugin(activity) {
  private fun resolveOrientation(orientation: String): Int {
    return when (orientation) {
      "portrait" -> ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
      "landscape" -> ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
      else -> ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
    }
  }

  @Command
  fun setImmersiveMode(invoke: Invoke) {
    val args = invoke.parseArgs(SetImmersiveModeArgs::class.java)
    activity.runOnUiThread {
      ImmersiveModeState.immersiveEnabled = args.enabled
      ImmersiveModeState.apply(activity)
    }
    invoke.resolve()
  }

  @Command
  fun setOrientation(invoke: Invoke) {
    val args = invoke.parseArgs(SetOrientationArgs::class.java)
    activity.runOnUiThread {
      ImmersiveModeState.requestedOrientation = resolveOrientation(args.orientation)
      ImmersiveModeState.apply(activity)
    }
    invoke.resolve()
  }

  @Command
  fun setPlayerMode(invoke: Invoke) {
    val args = invoke.parseArgs(SetPlayerModeArgs::class.java)
    activity.runOnUiThread {
      ImmersiveModeState.immersiveEnabled = args.enabled
      ImmersiveModeState.requestedOrientation = resolveOrientation(args.orientation)
      ImmersiveModeState.apply(activity)
    }
    invoke.resolve()
  }
}
