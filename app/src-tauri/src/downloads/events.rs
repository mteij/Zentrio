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

pub fn emit_progress(app: &AppHandle, payload: ProgressPayload) {
    let _ = app.emit("download:progress", payload);
}

pub fn emit_status(app: &AppHandle, payload: StatusPayload) {
    let _ = app.emit("download:status", payload);
}
