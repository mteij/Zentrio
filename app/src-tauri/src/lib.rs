use std::sync::{Arc, Mutex};
#[cfg(desktop)]
use tauri::Emitter;
use tauri::Manager;
#[cfg(any(windows, target_os = "linux"))]
use tauri_plugin_deep_link::DeepLinkExt;
#[cfg(all(desktop, not(debug_assertions)))]
use tauri_plugin_shell::ShellExt;

mod downloads;
mod plugins;

use downloads::{
    db::DownloadDb,
    file_store,
    manager::{DownloadManager, StartDownloadPayload},
};

struct ServerPort(Mutex<u16>);

#[tauri::command]
fn get_server_port(state: tauri::State<ServerPort>) -> u16 {
    *state.0.lock().unwrap()
}

// ─── Download commands ────────────────────────────────────────────────────────

#[tauri::command]
fn download_start(
    app: tauri::AppHandle,
    state: tauri::State<Arc<DownloadManager>>,
    payload: StartDownloadPayload,
) -> Result<String, String> {
    state.enqueue(app, payload)
}

#[tauri::command]
fn download_pause(
    app: tauri::AppHandle,
    state: tauri::State<Arc<DownloadManager>>,
    id: String,
) -> Result<(), String> {
    state.pause(app, &id)
}

#[tauri::command]
fn download_resume(
    app: tauri::AppHandle,
    state: tauri::State<Arc<DownloadManager>>,
    id: String,
) -> Result<(), String> {
    state.resume(app, &id)
}

#[tauri::command]
fn download_cancel(
    app: tauri::AppHandle,
    state: tauri::State<Arc<DownloadManager>>,
    id: String,
) -> Result<(), String> {
    state.cancel(app, &id)
}

#[tauri::command]
fn download_delete(
    app: tauri::AppHandle,
    state: tauri::State<Arc<DownloadManager>>,
    id: String,
) -> Result<(), String> {
    state.delete(app, &id)
}

#[tauri::command]
fn download_list(
    state: tauri::State<Arc<DownloadManager>>,
    profile_id: String,
) -> Result<Vec<downloads::db::DownloadRecord>, String> {
    state.get_downloads(&profile_id)
}

#[derive(serde::Serialize)]
pub struct StorageStats {
    pub total_bytes: i64,
    pub count: i64,
}

#[tauri::command]
fn download_storage_stats(
    state: tauri::State<Arc<DownloadManager>>,
    profile_id: String,
) -> Result<StorageStats, String> {
    let (total_bytes, count) = state.get_storage_stats(&profile_id)?;
    Ok(StorageStats { total_bytes, count })
}

#[tauri::command]
fn download_purge_profile(
    app: tauri::AppHandle,
    state: tauri::State<Arc<DownloadManager>>,
    profile_id: String,
) -> Result<(), String> {
    state.delete_all_for_profile(app, &profile_id)
}

#[tauri::command]
fn download_set_directory(
    app: tauri::AppHandle,
    path: String,
) -> Result<(), String> {
    file_store::set_custom_dir(&app, std::path::Path::new(&path))
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn download_get_directory(app: tauri::AppHandle) -> String {
    let data_dir = app.path()
        .app_data_dir()
        .unwrap_or_else(|_| std::path::PathBuf::from("."));
    data_dir.join("zentrio").join("downloads").to_string_lossy().to_string()
}

#[tauri::command]
fn download_get_quota(
    state: tauri::State<Arc<DownloadManager>>,
    profile_id: String,
) -> Result<i64, String> {
    state.get_quota(&profile_id)
}

#[tauri::command]
fn download_set_quota(
    state: tauri::State<Arc<DownloadManager>>,
    profile_id: String,
    quota_bytes: i64,
) -> Result<(), String> {
    state.set_quota(&profile_id, quota_bytes)
}

#[derive(serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SmartDefaults {
    pub smart_download: bool,
    pub auto_delete: bool,
}

#[tauri::command]
fn download_get_smart_defaults(
    state: tauri::State<Arc<DownloadManager>>,
    profile_id: String,
) -> Result<SmartDefaults, String> {
    let (smart_download, auto_delete) = state.get_smart_defaults(&profile_id)?;
    Ok(SmartDefaults { smart_download, auto_delete })
}

#[tauri::command]
fn download_set_smart_defaults(
    state: tauri::State<Arc<DownloadManager>>,
    profile_id: String,
    smart_download: bool,
    auto_delete: bool,
) -> Result<(), String> {
    state.set_smart_defaults(&profile_id, smart_download, auto_delete)
}

// ─────────────────────────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[allow(unused_mut)]
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_safe_area_insets_css::init());

    #[cfg(not(mobile))]
    {
        builder = builder
            .plugin(tauri_plugin_single_instance::init(
                |app, args: Vec<String>, _cwd| {
                    let _ = app
                        .get_webview_window("main")
                        .expect("no main window")
                        .set_focus();
                    if let Some(url) = args.iter().find(|&a| a.starts_with("zentrio://")) {
                        let _ = app.emit("zentrio-deep-link", url);
                    }
                },
            ))
            .plugin(tauri_plugin_updater::Builder::new().build());
    }

    builder
        .setup(|app| {
            // ── Downloads DB init ──────────────────────────────────────────
            let db_path = file_store::db_path(app.handle());
            if let Some(parent) = db_path.parent() {
                std::fs::create_dir_all(parent).ok();
            }
            let db = DownloadDb::open(&db_path).expect("Failed to open downloads DB");
            let manager = Arc::new(DownloadManager::new(db));
            app.manage(manager);
            // ──────────────────────────────────────────────────────────────

            // Explicitly register deep link scheme for development
            #[cfg(any(windows, target_os = "linux"))]
            {
                match app.deep_link().register("zentrio") {
                    Ok(_) => println!("[DeepLink] Registered 'zentrio' scheme"),
                    Err(e) => println!("[DeepLink] Failed to register scheme: {}", e),
                };

                // Check for deep link on startup
                use std::env;
                let args: Vec<String> = env::args().collect();
                if let Some(url) = args.iter().find(|&a| a.starts_with("zentrio://")) {
                    println!("[DeepLink] App started with URL: {}", url);
                    let app_handle = app.handle().clone();
                    let url = url.clone();
                    tauri::async_runtime::spawn(async move {
                        std::thread::sleep(std::time::Duration::from_millis(1500));
                        let _ = app_handle.emit("zentrio-deep-link", url);
                    });
                }
            }

            let port = 3000;
            app.manage(ServerPort(Mutex::new(port)));

            #[cfg(all(desktop, not(debug_assertions)))]
            {
                let handle = app.handle().clone();
                tauri::async_runtime::spawn(async move {
                    let sidecar = handle.shell().sidecar("zentrio-server").unwrap();
                    let (mut _rx, mut _child) = sidecar
                        .env("PORT", port.to_string())
                        .spawn()
                        .expect("Failed to spawn sidecar");
                });
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_server_port,
            plugins::immersive_mode::set_immersive_mode,
            // Download commands
            download_start,
            download_pause,
            download_resume,
            download_cancel,
            download_delete,
            download_list,
            download_storage_stats,
            download_purge_profile,
            download_set_directory,
            download_get_directory,
            download_get_quota,
            download_set_quota,
            download_get_smart_defaults,
            download_set_smart_defaults,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
