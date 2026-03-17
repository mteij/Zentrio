package com.zentrio.mteij

import android.app.Activity
import android.app.UiModeManager
import android.content.ContentUris
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.res.Configuration
import android.media.tv.TvContract
import android.net.Uri
import android.os.Build
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin

@InvokeArg
internal class UpsertWatchNextArgs {
  var internalProviderId: String = ""
  var mediaType: String = ""
  var title: String = ""
  var description: String? = null
  var posterUrl: String? = null
  var deepLinkUri: String = ""
  var playbackPositionMillis: Long = 0
  var durationMillis: Long = 0
  var lastEngagementTimeUtcMillis: Long = 0
  var watchNextType: Int = 0
}

@InvokeArg
internal class RemoveWatchNextArgs {
  var internalProviderId: String = ""
}

private object TvLauncherContract {
  const val COLUMN_ID = "_id"
  const val COLUMN_INTERNAL_PROVIDER_ID = "internal_provider_id"
  const val COLUMN_TYPE = "type"
  const val COLUMN_TITLE = "title"
  const val COLUMN_DESCRIPTION = "description"
  const val COLUMN_POSTER_ART_URI = "poster_art_uri"
  const val COLUMN_INTENT_URI = "intent_uri"
  const val COLUMN_LAST_PLAYBACK_POSITION_MILLIS = "last_playback_position_millis"
  const val COLUMN_DURATION_MILLIS = "duration_millis"
  const val COLUMN_LAST_ENGAGEMENT_TIME_UTC_MILLIS = "last_engagement_time_utc_millis"
  const val COLUMN_WATCH_NEXT_TYPE = "watch_next_type"
  const val TYPE_MOVIE = 0
  const val TYPE_TV_EPISODE = 2
}

private object TvLauncherSupport {
  fun isAvailable(context: Context): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return false

    val packageManager = context.packageManager
    val uiModeManager = context.getSystemService(Context.UI_MODE_SERVICE) as? UiModeManager
    val isLeanback = packageManager.hasSystemFeature(PackageManager.FEATURE_LEANBACK)
    val isTvMode = uiModeManager?.currentModeType == Configuration.UI_MODE_TYPE_TELEVISION

    return isLeanback || isTvMode
  }

  fun upsertWatchNext(activity: Activity, args: UpsertWatchNextArgs) {
    if (!isAvailable(activity) || args.internalProviderId.isBlank() || args.title.isBlank() || args.deepLinkUri.isBlank()) {
      return
    }

    val values = ContentValues().apply {
      put(TvLauncherContract.COLUMN_INTERNAL_PROVIDER_ID, args.internalProviderId)
      put(TvLauncherContract.COLUMN_TITLE, args.title)
      put(TvLauncherContract.COLUMN_TYPE, inferProgramType(args))
      put(TvLauncherContract.COLUMN_LAST_PLAYBACK_POSITION_MILLIS, args.playbackPositionMillis)
      put(TvLauncherContract.COLUMN_DURATION_MILLIS, args.durationMillis)
      put(TvLauncherContract.COLUMN_LAST_ENGAGEMENT_TIME_UTC_MILLIS, args.lastEngagementTimeUtcMillis)
      put(TvLauncherContract.COLUMN_WATCH_NEXT_TYPE, args.watchNextType)

      if (!args.description.isNullOrBlank()) {
        put(TvLauncherContract.COLUMN_DESCRIPTION, args.description)
      }

      if (!args.posterUrl.isNullOrBlank()) {
        put(TvLauncherContract.COLUMN_POSTER_ART_URI, args.posterUrl)
      }

      put(TvLauncherContract.COLUMN_INTENT_URI, buildIntentUri(activity, args.deepLinkUri))
    }

    val existingId = findWatchNextProgramId(activity, args.internalProviderId)
    val resolver = activity.contentResolver

    if (existingId == null) {
      resolver.insert(TvContract.WatchNextPrograms.CONTENT_URI, values)
    } else {
      val programUri = ContentUris.withAppendedId(TvContract.WatchNextPrograms.CONTENT_URI, existingId)
      resolver.update(programUri, values, null, null)
    }
  }

  fun removeWatchNext(activity: Activity, internalProviderId: String) {
    if (!isAvailable(activity) || internalProviderId.isBlank()) {
      return
    }

    val existingId = findWatchNextProgramId(activity, internalProviderId) ?: return
    val programUri = ContentUris.withAppendedId(TvContract.WatchNextPrograms.CONTENT_URI, existingId)
    activity.contentResolver.delete(programUri, null, null)
  }

  private fun inferProgramType(args: UpsertWatchNextArgs): Int {
    return if (args.mediaType.equals("series", ignoreCase = true)) {
      TvLauncherContract.TYPE_TV_EPISODE
    } else {
      TvLauncherContract.TYPE_MOVIE
    }
  }

  private fun buildIntentUri(activity: Activity, deepLinkUri: String): String {
    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(deepLinkUri)).apply {
      setPackage(activity.packageName)
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    }

    return intent.toUri(Intent.URI_INTENT_SCHEME)
  }

  private fun findWatchNextProgramId(context: Context, internalProviderId: String): Long? {
    context.contentResolver.query(
      TvContract.WatchNextPrograms.CONTENT_URI,
      arrayOf(TvLauncherContract.COLUMN_ID),
      "${TvLauncherContract.COLUMN_INTERNAL_PROVIDER_ID} = ?",
      arrayOf(internalProviderId),
      null
    )?.use { cursor ->
      if (cursor.moveToFirst()) {
        return cursor.getLong(0)
      }
    }

    return null
  }
}

@TauriPlugin
class TvLauncherPlugin(private val activity: Activity) : Plugin(activity) {
  @Command
  fun getEnvironment(invoke: Invoke) {
    activity.runOnUiThread {
      val isTv = TvLauncherSupport.isAvailable(activity)
      invoke.resolve(
        JSObject()
          .put("isTv", isTv)
          .put("supportsWatchNext", Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && isTv)
      )
    }
  }

  @Command
  fun upsertWatchNext(invoke: Invoke) {
    val args = invoke.parseArgs(UpsertWatchNextArgs::class.java)
    activity.runOnUiThread {
      TvLauncherSupport.upsertWatchNext(activity, args)
      invoke.resolve()
    }
  }

  @Command
  fun removeWatchNext(invoke: Invoke) {
    val args = invoke.parseArgs(RemoveWatchNextArgs::class.java)
    activity.runOnUiThread {
      TvLauncherSupport.removeWatchNext(activity, args.internalProviderId)
      invoke.resolve()
    }
  }
}
