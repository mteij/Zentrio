use tauri_plugin_shell::ShellExt;
use std::sync::Mutex;
use tauri::Manager;

struct ServerPort(Mutex<u16>);

#[tauri::command]
fn get_server_port(state: tauri::State<ServerPort>) -> u16 {
    *state.0.lock().unwrap()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_deep_link::init())
        .setup(|app| {
            let port = 3000; // Default port, or find a free one
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
        .invoke_handler(tauri::generate_handler![get_server_port])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}