use std::path::{Path, PathBuf};
use tauri::Manager;

/// Returns the base downloads directory for a given profile.
/// Uses the custom path stored in app data if set, otherwise defaults to the OS app data dir.
pub fn downloads_dir(app: &tauri::AppHandle, profile_id: &str) -> PathBuf {
    let base = custom_dir(app).unwrap_or_else(|| {
        app.path()
            .app_data_dir()
            .unwrap_or_else(|_| PathBuf::from("."))
            .join("zentrio")
    });
    base.join("downloads").join(profile_id)
}

/// Returns the path to the per-app downloads SQLite database.
pub fn db_path(app: &tauri::AppHandle) -> PathBuf {
    let data_dir = app
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."));
    data_dir.join("zentrio").join("downloads.db")
}

/// Returns a unique file path for a download (without extension — caller appends `.mp4`).
pub fn download_file_path(app: &tauri::AppHandle, profile_id: &str, id: &str) -> PathBuf {
    downloads_dir(app, profile_id).join(format!("{}.mp4", id))
}

/// Returns the `.zentrio-part` temporary path for an in-progress download.
pub fn part_file_path(app: &tauri::AppHandle, profile_id: &str, id: &str) -> PathBuf {
    downloads_dir(app, profile_id).join(format!("{}.zentrio-part", id))
}

/// Ensures the profile download directory exists.
pub fn ensure_dir(app: &tauri::AppHandle, profile_id: &str) -> std::io::Result<()> {
    let dir = downloads_dir(app, profile_id);
    std::fs::create_dir_all(&dir)
}

/// Reads the custom download directory from the app's local storage (synchronous key lookup).
fn custom_dir(app: &tauri::AppHandle) -> Option<PathBuf> {
    let data_dir = app.path().app_data_dir().ok()?;
    let path_file = data_dir.join("zentrio").join("download_dir.txt");
    let raw = std::fs::read_to_string(path_file).ok()?;
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(PathBuf::from(trimmed))
    }
}

/// Persists the custom download directory.
pub fn set_custom_dir(app: &tauri::AppHandle, new_path: &Path) -> std::io::Result<()> {
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e.to_string()))?;
    let dir = data_dir.join("zentrio");
    std::fs::create_dir_all(&dir)?;
    std::fs::write(
        dir.join("download_dir.txt"),
        new_path.to_string_lossy().as_bytes(),
    )
}

/// Returns the path for a downloaded subtitle file.
pub fn subtitle_file_path(
    app: &tauri::AppHandle,
    profile_id: &str,
    id: &str,
    lang: &str,
) -> PathBuf {
    // Sanitize lang to avoid path traversal
    let safe_lang: String = lang
        .chars()
        .filter(|c| c.is_alphanumeric() || *c == '-' || *c == '_')
        .collect();
    let safe_lang = if safe_lang.is_empty() {
        "und".to_string()
    } else {
        safe_lang
    };
    downloads_dir(app, profile_id).join(format!("{}_{}.vtt", id, safe_lang))
}

/// Deletes the download file (and any .zentrio-part) for a given ID.
pub fn delete_files(app: &tauri::AppHandle, profile_id: &str, id: &str) {
    let _ = std::fs::remove_file(download_file_path(app, profile_id, id));
    let _ = std::fs::remove_file(part_file_path(app, profile_id, id));
}

/// Deletes subtitle files listed in a JSON subtitle_paths string.
pub fn delete_subtitle_files(paths_json: Option<&str>) {
    let json = match paths_json {
        Some(s) if !s.is_empty() => s,
        _ => return,
    };
    if let Ok(entries) = serde_json::from_str::<Vec<serde_json::Value>>(json) {
        for entry in entries {
            if let Some(path) = entry.get("path").and_then(|p| p.as_str()) {
                let _ = std::fs::remove_file(path);
            }
        }
    }
}

/// Returns file size in bytes if the file exists.
pub fn file_size(path: &Path) -> i64 {
    std::fs::metadata(path).map(|m| m.len() as i64).unwrap_or(0)
}
