use tauri::AppHandle;
use tauri_plugin_notification::NotificationExt;

/// Sends or updates an OS notification for a download.
/// On most platforms the notification is replaced by using the same `identifier`.
pub fn notify_progress(app: &AppHandle, id: &str, title: &str, progress: u8, speed_kb: f64) {
    let body = format!("Downloading {}% • {:.0} KB/s", progress, speed_kb);
    let _ = app
        .notification()
        .builder()
        .title("Zentrio Downloads")
        .body(format!("{}\n{}", title, body))
        .show();
}

pub fn notify_complete(app: &AppHandle, title: &str) {
    let _ = app
        .notification()
        .builder()
        .title("✓ Ready to watch")
        .body(title.to_string())
        .show();
}

pub fn notify_failed(app: &AppHandle, title: &str) {
    let _ = app
        .notification()
        .builder()
        .title("⚠ Download failed")
        .body(format!("{} — Tap to retry", title))
        .show();
}
