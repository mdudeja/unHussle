use std::sync::Mutex;
use std::thread;
use std::time::Duration;
use tauri::path::BaseDirectory;
use tauri::{AppHandle, Manager};
use tauri_plugin_shell::process::CommandChild;
use tauri_plugin_shell::ShellExt;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

struct DbServer(Mutex<Option<CommandChild>>);

fn start_db_server(app: &AppHandle) -> Result<CommandChild, String> {
    use tauri::Manager;

    // Get app data directory and resource directory
    let db_path = app
        .path()
        .resolve("db/ecn.unhussle.sqlite", BaseDirectory::AppData)
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;
    let migrations_path = app
        .path()
        .resolve("resources/drizzle_migrations", BaseDirectory::Resource)
        .map_err(|e| format!("Failed to get resource directory: {}", e))?;

    // Ensure app data directory exists
    std::fs::create_dir_all(&db_path.parent().unwrap())
        .map_err(|e| format!("Failed to create app data directory: {}", e))?;

    println!("Database path: {:?}", db_path.to_str().unwrap());
    println!("Migrations path: {:?}", migrations_path.to_str().unwrap());

    let sidecar_command = app
        .shell()
        .sidecar("db-server")
        .unwrap()
        .env("DB_FILE_URL", db_path.to_str().unwrap())
        .env("DB_MIGRATIONS_DIR", migrations_path.to_str().unwrap());

    let (mut rx, child) = sidecar_command
        .spawn()
        .map_err(|e| format!("Failed to spawn database server sidecar: {}", e))?;

    // Spawn an async task to read and print sidecar output
    tauri::async_runtime::spawn(async move {
        use tauri_plugin_shell::process::CommandEvent;
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(line) => {
                    print!("[DB Server] {}", String::from_utf8_lossy(&line));
                }
                CommandEvent::Stderr(line) => {
                    eprint!("[DB Server ERROR] {}", String::from_utf8_lossy(&line));
                }
                CommandEvent::Error(err) => {
                    eprintln!("[DB Server] Error: {}", err);
                }
                CommandEvent::Terminated(payload) => {
                    println!(
                        "[DB Server] Process terminated with code: {:?}",
                        payload.code
                    );
                    break;
                }
                _ => {}
            }
        }
    });

    Ok(child)
}

fn shutdown_db_server(child: CommandChild) {
    let pid = child.pid();
    println!("Initiating database server shutdown (PID: {})...", pid);

    // First, try graceful shutdown with SIGTERM
    #[cfg(unix)]
    {
        use std::process::Command;
        let sigterm_result = Command::new("kill")
            .arg("-TERM")
            .arg(pid.to_string())
            .status();

        match sigterm_result {
            Ok(_) => {
                println!("Sent SIGTERM to database server, waiting for graceful shutdown...");
                // Wait up to 5 seconds for graceful shutdown
                for i in 0..10 {
                    thread::sleep(Duration::from_millis(500));
                    // Check if process is still running
                    let check = Command::new("kill").arg("-0").arg(pid.to_string()).status();

                    if check.is_err() || !check.unwrap().success() {
                        println!("Database server shut down gracefully.");
                        return;
                    }

                    if i == 9 {
                        println!("Database server did not respond to SIGTERM, forcing shutdown...");
                    }
                }
            }
            Err(e) => {
                println!("Failed to send SIGTERM: {}, forcing shutdown...", e);
            }
        }
    }

    // Force kill if graceful shutdown failed or on non-Unix systems
    match child.kill() {
        Ok(_) => println!("Database server terminated successfully (PID: {}).", pid),
        Err(e) => eprintln!("Failed to kill database server (PID: {}): {}", pid, e),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .manage(DbServer(Mutex::new(None)))
        .setup(|app| {
            let handle = app.handle();

            // Start the database server sidecar
            match start_db_server(&handle) {
                Ok(child) => {
                    let pid = child.pid();
                    let state = handle.state::<DbServer>();
                    *state.0.lock().unwrap() = Some(child);
                    println!(
                        "Database server initialized successfully. Process id {}",
                        pid
                    );
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
                println!("Application exit detected, cleaning up...");
                if let Some(state) = app_handle.try_state::<DbServer>() {
                    if let Ok(mut child_lock) = state.0.lock() {
                        if let Some(child) = child_lock.take() {
                            shutdown_db_server(child);
                        } else {
                            println!("Database server was not running.");
                        }
                    } else {
                        eprintln!("Failed to acquire lock for database server cleanup.");
                    }
                } else {
                    eprintln!("Database server state not found during cleanup.");
                }
                println!("Cleanup completed.");
            }
        });
}
