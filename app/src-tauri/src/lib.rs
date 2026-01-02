#[cfg(all(desktop, not(debug_assertions)))]
use tauri_plugin_shell::ShellExt;
#[cfg(any(windows, target_os = "linux"))]
use tauri_plugin_deep_link::DeepLinkExt;
use std::sync::Mutex;
use tauri::Manager;
#[cfg(desktop)]
use tauri::Emitter;

struct ServerPort(Mutex<u16>);

#[tauri::command]
fn get_server_port(state: tauri::State<ServerPort>) -> u16 {
    *state.0.lock().unwrap()
}

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
        .plugin(tauri_plugin_deep_link::init());

    #[cfg(not(mobile))]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, args: Vec<String>, _cwd| {
            let _ = app.get_webview_window("main").expect("no main window").set_focus();
            if let Some(url) = args.iter().find(|&a| a.starts_with("zentrio://")) {
                let _ = app.emit("deep-link://new-url", url);
            }
        }));
    }

    builder
        .setup(|app| {
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
                   // Emit event slightly later to ensure frontend is ready
                   tauri::async_runtime::spawn(async move {
                       // wait for frontend to load
                       std::thread::sleep(std::time::Duration::from_millis(1500));
                       let _ = app_handle.emit("deep-link://new-url", url);
                   });
               }
            }

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