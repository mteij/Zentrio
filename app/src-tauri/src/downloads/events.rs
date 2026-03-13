use tauri::{AppHandle, Emitter};
use serde::Serialize;

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ProgressPayload {
    pub id: String,
    pub progress: f64,
    pub downloaded_bytes: i64,
    pub speed: f64, // bytes/s
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct StatusPayload {
    pub id: String,
    pub status: String,
    pub file_path: Option<String>,
    pub error: Option<String>,
}

/// Emitted when Smart Downloads detects the next episode should be queued.
/// The frontend is responsible for resolving the stream URL and calling download_start.
#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SmartNextPayload {
    pub profile_id: String,
    pub media_id: String,
    pub media_type: String,
    pub title: String,
    pub poster_path: String,
    pub addon_id: String,
    pub quality: String,
    pub season: i64,
    pub episode: i64,
    pub smart_download: bool,
    pub auto_delete: bool,
}

pub fn emit_progress(app: &AppHandle, payload: ProgressPayload) {
    let _ = app.emit("download:progress", payload);
}

pub fn emit_status(app: &AppHandle, payload: StatusPayload) {
    let _ = app.emit("download:status", payload);
}

pub fn emit_smart_next(app: &AppHandle, payload: SmartNextPayload) {
    let _ = app.emit("download:queue_next", payload);
}
