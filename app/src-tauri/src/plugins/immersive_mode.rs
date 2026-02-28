//! Immersive mode plugin for Android
//! Controls system UI visibility (status bar, navigation bar)

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetImmersiveModeArgs {
    // Field is used by the Kotlin plugin via JSON serialization
    #[allow(dead_code)]
    pub enabled: bool,
}

/// Set immersive mode on Android (hides/shows system bars)
/// This command is handled by the Kotlin plugin (ImmersiveModePlugin.kt)
#[tauri::command]
pub async fn set_immersive_mode(
    _args: SetImmersiveModeArgs,
) -> Result<(), String> {
    // The actual implementation is in the Kotlin plugin
    // This Rust command acts as a bridge to the mobile plugin
    Ok(())
}