use tauri::{Manager, AppHandle};
use std::process::{Command, Child};
use std::sync::Mutex;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

struct DbServer(Mutex<Option<Child>>);

fn start_db_server(_app: &AppHandle) -> Result<Child, String> {
    let manifest_dir = std::env::var("CARGO_MANIFEST_DIR")
        .map_err(|e| format!("Failed to get manifest dir: {}", e))?;
    
    let sidecar_path = std::path::PathBuf::from(manifest_dir)
        .join("binaries")
        .join("db-server");
    
    println!("Starting database server from: {:?}", sidecar_path);
    
    if !sidecar_path.exists() {
        return Err(format!("Database server binary not found. Run: bun run build:server"));
    }
    
    let child = Command::new(sidecar_path)
        .spawn()
        .map_err(|e| format!("Failed to start database server: {}", e))?;
    
    println!("Database server started with PID: {}", child.id());
    Ok(child)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .manage(DbServer(Mutex::new(None)))
        .setup(|app| {
            let handle = app.handle();
            
            // Start the database server sidecar
            match start_db_server(&handle) {
                Ok(child) => {
                    let state = handle.state::<DbServer>();
                    *state.0.lock().unwrap() = Some(child);
                    println!("Database server initialized successfully");
                }
                Err(e) => {
                    eprintln!("Warning: Failed to start database server: {}", e);
                }
            }
            
            Ok(())
        })
        .on_window_event(|_window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                // Cleanup is handled on app exit
            }
        })
        .invoke_handler(tauri::generate_handler![greet])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            if let tauri::RunEvent::Exit = event {
                // Kill the database server when the app exits
                if let Some(state) = app_handle.try_state::<DbServer>() {
                    if let Ok(mut child_lock) = state.0.lock() {
                        if let Some(mut child) = child_lock.take() {
                            println!("Shutting down database server...");
                            let _ = child.kill();
                            let _ = child.wait();
                        }
                    }
                }
            }
        });
}
