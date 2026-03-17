use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::{
    ipc::JavaScriptChannelId,
    plugin::{Builder, TauriPlugin},
    AppHandle, Runtime, Webview,
};

#[cfg(target_os = "android")]
use tauri::{ipc::Channel, plugin::PluginApi, Manager};

#[cfg(target_os = "android")]
pub struct ExoPlayerMobilePlugin<R: Runtime>(pub tauri::plugin::PluginHandle<R>);

#[cfg(target_os = "android")]
pub struct TvLauncherMobilePlugin<R: Runtime>(pub tauri::plugin::PluginHandle<R>);

#[cfg(target_os = "android")]
pub struct ImmersiveModeMobilePlugin<R: Runtime>(pub tauri::plugin::PluginHandle<R>);

#[cfg_attr(not(target_os = "android"), allow(dead_code))]
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExoPlayerPlayArgs {
    pub url: String,
    pub start_position_ms: i64,
    pub is_tv: bool,
    pub on_event: JavaScriptChannelId,
}

#[cfg(target_os = "android")]
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ExoPlayerMobilePlayArgs {
    url: String,
    start_position_ms: i64,
    is_tv: bool,
    on_event: Channel<Value>,
}

#[cfg(target_os = "android")]
impl ExoPlayerPlayArgs {
    fn into_mobile<R: Runtime>(self, webview: Webview<R>) -> ExoPlayerMobilePlayArgs {
        ExoPlayerMobilePlayArgs {
            url: self.url,
            start_position_ms: self.start_position_ms,
            is_tv: self.is_tv,
            on_event: self.on_event.channel_on(webview),
        }
    }
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExoPlayerSeekArgs {
    pub position_ms: i64,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExoPlayerVolumeArgs {
    pub volume: f32,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExoPlayerSpeedArgs {
    pub speed: f32,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExoPlayerTrackArgs {
    pub group_index: i32,
    pub track_index: i32,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImmersiveModeArgs {
    pub enabled: bool,
    pub orientation: String,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WatchNextArgs {
    pub internal_provider_id: String,
    pub media_type: String,
    pub title: String,
    pub description: Option<String>,
    pub poster_url: Option<String>,
    pub deep_link_uri: String,
    pub playback_position_millis: i64,
    pub duration_millis: i64,
    pub last_engagement_time_utc_millis: i64,
    pub watch_next_type: i32,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoveWatchNextArgs {
    pub internal_provider_id: String,
}

#[cfg(target_os = "android")]
fn plugin_error(error: impl std::fmt::Display) -> String {
    error.to_string()
}

#[cfg(target_os = "android")]
fn exo_handle<R: Runtime>(
    app: &AppHandle<R>,
) -> Result<tauri::State<'_, ExoPlayerMobilePlugin<R>>, String> {
    app.try_state::<ExoPlayerMobilePlugin<R>>()
        .ok_or_else(|| "Android ExoPlayer bridge is not registered".to_string())
}

#[cfg(target_os = "android")]
fn tv_launcher_handle<R: Runtime>(
    app: &AppHandle<R>,
) -> Result<tauri::State<'_, TvLauncherMobilePlugin<R>>, String> {
    app.try_state::<TvLauncherMobilePlugin<R>>()
        .ok_or_else(|| "Android TV launcher bridge is not registered".to_string())
}

#[cfg(target_os = "android")]
fn immersive_mode_handle<R: Runtime>(
    app: &AppHandle<R>,
) -> Result<tauri::State<'_, ImmersiveModeMobilePlugin<R>>, String> {
    app.try_state::<ImmersiveModeMobilePlugin<R>>()
        .ok_or_else(|| "Android immersive mode bridge is not registered".to_string())
}

pub fn init_exo_player<R: Runtime>() -> TauriPlugin<R, Value> {
    Builder::new("android-exo-player")
        .setup(|_app, _api| {
            #[cfg(target_os = "android")]
            {
                let handle = _api.register_android_plugin("com.zentrio.mteij", "ExoPlayerPlugin")?;
                _app.manage(ExoPlayerMobilePlugin(handle));
            }
            Ok(())
        })
        .build()
}

pub fn init_tv_launcher<R: Runtime>() -> TauriPlugin<R, Value> {
    Builder::new("android-tv-launcher")
        .setup(|_app, _api| {
            #[cfg(target_os = "android")]
            {
                let handle = _api.register_android_plugin("com.zentrio.mteij", "TvLauncherPlugin")?;
                _app.manage(TvLauncherMobilePlugin(handle));
            }
            Ok(())
        })
        .build()
}

pub fn init_immersive_mode<R: Runtime>() -> TauriPlugin<R, Value> {
    Builder::new("android-immersive-mode")
        .setup(|_app, _api| {
            #[cfg(target_os = "android")]
            {
                let handle = _api.register_android_plugin("com.zentrio.mteij", "ImmersiveModePlugin")?;
                _app.manage(ImmersiveModeMobilePlugin(handle));
            }
            Ok(())
        })
        .build()
}

#[tauri::command]
pub fn exo_player_play<R: Runtime>(
    app: AppHandle<R>,
    webview: Webview<R>,
    args: ExoPlayerPlayArgs,
) -> Result<Value, String> {
    #[cfg(target_os = "android")]
    {
        return exo_handle(&app)?
            .0
            .run_mobile_plugin("play", args.into_mobile(webview))
            .map_err(plugin_error);
    }

    #[cfg(not(target_os = "android"))]
    {
        let _ = (app, webview, args);
        Err("Android ExoPlayer bridge unavailable on this platform".into())
    }
}

#[tauri::command]
pub fn exo_player_player<R: Runtime>(
    app: AppHandle<R>,
    webview: Webview<R>,
    args: ExoPlayerPlayArgs,
) -> Result<Value, String> {
    exo_player_play(app, webview, args)
}

#[tauri::command]
pub fn command_exo_player_play<R: Runtime>(
    app: AppHandle<R>,
    webview: Webview<R>,
    args: ExoPlayerPlayArgs,
) -> Result<Value, String> {
    exo_player_play(app, webview, args)
}

#[tauri::command]
pub fn command_exo_player_player<R: Runtime>(
    app: AppHandle<R>,
    webview: Webview<R>,
    args: ExoPlayerPlayArgs,
) -> Result<Value, String> {
    exo_player_play(app, webview, args)
}

#[tauri::command]
pub fn exo_player_pause<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    #[cfg(target_os = "android")]
    {
        exo_handle(&app)?
            .0
            .run_mobile_plugin::<Value>("pause", ())
            .map_err(plugin_error)?;
        return Ok(());
    }

    #[cfg(not(target_os = "android"))]
    {
        let _ = app;
        Err("Android ExoPlayer bridge unavailable on this platform".into())
    }
}

#[tauri::command]
pub fn command_exo_player_pause<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    exo_player_pause(app)
}

#[tauri::command]
pub fn exo_player_resume<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    #[cfg(target_os = "android")]
    {
        exo_handle(&app)?
            .0
            .run_mobile_plugin::<Value>("resume", ())
            .map_err(plugin_error)?;
        return Ok(());
    }

    #[cfg(not(target_os = "android"))]
    {
        let _ = app;
        Err("Android ExoPlayer bridge unavailable on this platform".into())
    }
}

#[tauri::command]
pub fn command_exo_player_resume<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    exo_player_resume(app)
}

#[tauri::command]
pub fn exo_player_seek<R: Runtime>(app: AppHandle<R>, args: ExoPlayerSeekArgs) -> Result<(), String> {
    #[cfg(target_os = "android")]
    {
        exo_handle(&app)?
            .0
            .run_mobile_plugin::<Value>("seek", args)
            .map_err(plugin_error)?;
        return Ok(());
    }

    #[cfg(not(target_os = "android"))]
    {
        let _ = (app, args);
        Err("Android ExoPlayer bridge unavailable on this platform".into())
    }
}

#[tauri::command]
pub fn command_exo_player_seek<R: Runtime>(
    app: AppHandle<R>,
    args: ExoPlayerSeekArgs,
) -> Result<(), String> {
    exo_player_seek(app, args)
}

#[tauri::command]
pub fn exo_player_stop<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    #[cfg(target_os = "android")]
    {
        exo_handle(&app)?
            .0
            .run_mobile_plugin::<Value>("stop", ())
            .map_err(plugin_error)?;
        return Ok(());
    }

    #[cfg(not(target_os = "android"))]
    {
        let _ = app;
        Err("Android ExoPlayer bridge unavailable on this platform".into())
    }
}

#[tauri::command]
pub fn command_exo_player_stop<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    exo_player_stop(app)
}

#[tauri::command]
pub fn exo_player_set_volume<R: Runtime>(
    app: AppHandle<R>,
    args: ExoPlayerVolumeArgs,
) -> Result<(), String> {
    #[cfg(target_os = "android")]
    {
        exo_handle(&app)?
            .0
            .run_mobile_plugin::<Value>("setVolume", args)
            .map_err(plugin_error)?;
        return Ok(());
    }

    #[cfg(not(target_os = "android"))]
    {
        let _ = (app, args);
        Err("Android ExoPlayer bridge unavailable on this platform".into())
    }
}

#[tauri::command]
pub fn command_exo_player_set_volume<R: Runtime>(
    app: AppHandle<R>,
    args: ExoPlayerVolumeArgs,
) -> Result<(), String> {
    exo_player_set_volume(app, args)
}

#[tauri::command]
pub fn exo_player_set_playback_speed<R: Runtime>(
    app: AppHandle<R>,
    args: ExoPlayerSpeedArgs,
) -> Result<(), String> {
    #[cfg(target_os = "android")]
    {
        exo_handle(&app)?
            .0
            .run_mobile_plugin::<Value>("setPlaybackSpeed", args)
            .map_err(plugin_error)?;
        return Ok(());
    }

    #[cfg(not(target_os = "android"))]
    {
        let _ = (app, args);
        Err("Android ExoPlayer bridge unavailable on this platform".into())
    }
}

#[tauri::command]
pub fn exo_player_set_audio_track<R: Runtime>(
    app: AppHandle<R>,
    args: ExoPlayerTrackArgs,
) -> Result<(), String> {
    #[cfg(target_os = "android")]
    {
        exo_handle(&app)?
            .0
            .run_mobile_plugin::<Value>("setAudioTrack", args)
            .map_err(plugin_error)?;
        return Ok(());
    }

    #[cfg(not(target_os = "android"))]
    {
        let _ = (app, args);
        Err("Android ExoPlayer bridge unavailable on this platform".into())
    }
}

#[tauri::command]
pub fn command_exo_player_set_audio_track<R: Runtime>(
    app: AppHandle<R>,
    args: ExoPlayerTrackArgs,
) -> Result<(), String> {
    exo_player_set_audio_track(app, args)
}

#[tauri::command]
pub fn exo_player_set_subtitle_track<R: Runtime>(
    app: AppHandle<R>,
    args: ExoPlayerTrackArgs,
) -> Result<(), String> {
    #[cfg(target_os = "android")]
    {
        exo_handle(&app)?
            .0
            .run_mobile_plugin::<Value>("setSubtitleTrack", args)
            .map_err(plugin_error)?;
        return Ok(());
    }

    #[cfg(not(target_os = "android"))]
    {
        let _ = (app, args);
        Err("Android ExoPlayer bridge unavailable on this platform".into())
    }
}

#[tauri::command]
pub fn command_exo_player_set_subtitle_track<R: Runtime>(
    app: AppHandle<R>,
    args: ExoPlayerTrackArgs,
) -> Result<(), String> {
    exo_player_set_subtitle_track(app, args)
}

#[tauri::command]
pub fn exo_player_get_state<R: Runtime>(app: AppHandle<R>) -> Result<Value, String> {
    #[cfg(target_os = "android")]
    {
        return exo_handle(&app)?
            .0
            .run_mobile_plugin("getState", ())
            .map_err(plugin_error);
    }

    #[cfg(not(target_os = "android"))]
    {
        let _ = app;
        Err("Android ExoPlayer bridge unavailable on this platform".into())
    }
}

#[tauri::command]
pub fn command_exo_player_get_state<R: Runtime>(app: AppHandle<R>) -> Result<Value, String> {
    exo_player_get_state(app)
}

#[tauri::command]
pub fn tv_launcher_get_environment<R: Runtime>(app: AppHandle<R>) -> Result<Value, String> {
    #[cfg(target_os = "android")]
    {
        return tv_launcher_handle(&app)?
            .0
            .run_mobile_plugin("getEnvironment", ())
            .map_err(plugin_error);
    }

    #[cfg(not(target_os = "android"))]
    {
        let _ = app;
        Err("Android TV launcher bridge unavailable on this platform".into())
    }
}

#[tauri::command]
pub fn command_tv_launcher_get_environment<R: Runtime>(app: AppHandle<R>) -> Result<Value, String> {
    tv_launcher_get_environment(app)
}

#[tauri::command]
pub fn tv_launcher_upsert_watch_next<R: Runtime>(
    app: AppHandle<R>,
    args: WatchNextArgs,
) -> Result<(), String> {
    #[cfg(target_os = "android")]
    {
        tv_launcher_handle(&app)?
            .0
            .run_mobile_plugin::<Value>("upsertWatchNext", args)
            .map_err(plugin_error)?;
        return Ok(());
    }

    #[cfg(not(target_os = "android"))]
    {
        let _ = (app, args);
        Err("Android TV launcher bridge unavailable on this platform".into())
    }
}

#[tauri::command]
pub fn command_tv_launcher_upsert_watch_next<R: Runtime>(
    app: AppHandle<R>,
    args: WatchNextArgs,
) -> Result<(), String> {
    tv_launcher_upsert_watch_next(app, args)
}

#[tauri::command]
pub fn tv_launcher_remove_watch_next<R: Runtime>(
    app: AppHandle<R>,
    args: RemoveWatchNextArgs,
) -> Result<(), String> {
    #[cfg(target_os = "android")]
    {
        tv_launcher_handle(&app)?
            .0
            .run_mobile_plugin::<Value>("removeWatchNext", args)
            .map_err(plugin_error)?;
        return Ok(());
    }

    #[cfg(not(target_os = "android"))]
    {
        let _ = (app, args);
        Err("Android TV launcher bridge unavailable on this platform".into())
    }
}

#[tauri::command]
pub fn command_tv_launcher_remove_watch_next<R: Runtime>(
    app: AppHandle<R>,
    args: RemoveWatchNextArgs,
) -> Result<(), String> {
    tv_launcher_remove_watch_next(app, args)
}

#[tauri::command]
pub fn immersive_mode_set_player_mode<R: Runtime>(
    app: AppHandle<R>,
    args: ImmersiveModeArgs,
) -> Result<(), String> {
    #[cfg(target_os = "android")]
    {
        immersive_mode_handle(&app)?
            .0
            .run_mobile_plugin::<Value>("setPlayerMode", args)
            .map_err(plugin_error)?;
        return Ok(());
    }

    #[cfg(not(target_os = "android"))]
    {
        let _ = (app, args);
        Err("Android immersive mode bridge unavailable on this platform".into())
    }
}

#[tauri::command]
pub fn command_immersive_mode_set_player_mode<R: Runtime>(
    app: AppHandle<R>,
    args: ImmersiveModeArgs,
) -> Result<(), String> {
    immersive_mode_set_player_mode(app, args)
}
