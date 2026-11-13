use std::collections::hash_map::RandomState;
use std::hash::{BuildHasher, Hasher};
use std::io::Write;
use std::net::{SocketAddr, TcpStream};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant, SystemTime};
use tauri::path::BaseDirectory;
use tauri::{AppHandle, Manager};
use tauri_plugin_shell::process::CommandChild;
use tauri_plugin_shell::ShellExt;

// Matches the server's default in src-db-server/server.ts.
const DEFAULT_DB_SERVER_PORT: u16 = 3456;
const SHUTDOWN_CONNECT_TIMEOUT: Duration = Duration::from_secs(1);
const SHUTDOWN_EXIT_TIMEOUT: Duration = Duration::from_secs(5);
const SHUTDOWN_POLL_INTERVAL: Duration = Duration::from_millis(100);

struct DbServerProcess {
    child: CommandChild,
    /// Set once the sidecar's process has ended.
    exited: Arc<AtomicBool>,
    port: u16,
    shutdown_token: String,
}

struct DbServer(Mutex<Option<DbServerProcess>>);

fn db_server_port() -> u16 {
    std::env::var("VITE_DB_SERVER_PORT")
        .ok()
        .and_then(|port| port.parse().ok())
        .unwrap_or(DEFAULT_DB_SERVER_PORT)
}

/// A new secret per launch, so only this app can ask the server to shut down.
fn new_shutdown_token() -> String {
    let part = |salt: u64| {
        let mut hasher = RandomState::new().build_hasher();
        hasher.write_u64(salt);
        if let Ok(elapsed) = SystemTime::now().duration_since(SystemTime::UNIX_EPOCH) {
            hasher.write_u128(elapsed.as_nanos());
        }
        hasher.finish()
    };
    format!("{:016x}{:016x}", part(0), part(1))
}

fn start_db_server(app: &AppHandle) -> Result<DbServerProcess, String> {
    // Get app data directory and resource directory
    let db_path = app
        .path()
        .resolve("db/ecn.unhussle.sqlite", BaseDirectory::AppData)
        .map_err(|e| format!("Failed to get app data directory: {}", e))?;
    let migrations_path = app
        .path()
        .resolve("resources/drizzle_migrations", BaseDirectory::Resource)
        .map_err(|e| format!("Failed to get resource directory: {}", e))?;

    // Resources are markdown files in the vault; the user can move it later.
    let vault_path = app
        .path()
        .resolve("vault", BaseDirectory::AppData)
        .map_err(|e| format!("Failed to get vault directory: {}", e))?;

    // Ensure app data directory exists
    std::fs::create_dir_all(db_path.parent().unwrap())
        .map_err(|e| format!("Failed to create app data directory: {}", e))?;
    std::fs::create_dir_all(&vault_path)
        .map_err(|e| format!("Failed to create vault directory: {}", e))?;

    println!("Database path: {:?}", db_path.to_str().unwrap());
    println!("Migrations path: {:?}", migrations_path.to_str().unwrap());
    println!("Vault path: {:?}", vault_path.to_str().unwrap());

    let port = db_server_port();
    let shutdown_token = new_shutdown_token();
    let sidecar_command = app
        .shell()
        .sidecar("db-server")
        .unwrap()
        .env("DB_FILE_URL", db_path.to_str().unwrap())
        .env("DB_MIGRATIONS_DIR", migrations_path.to_str().unwrap())
        .env("VAULT_DIR", vault_path.to_str().unwrap())
        .env("VITE_DB_SERVER_PORT", port.to_string())
        .env("DB_SERVER_SHUTDOWN_TOKEN", &shutdown_token);

    let (mut rx, child) = sidecar_command
        .spawn()
        .map_err(|e| format!("Failed to spawn database server sidecar: {}", e))?;

    let exited = Arc::new(AtomicBool::new(false));
    let exited_writer = Arc::clone(&exited);

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
                    exited_writer.store(true, Ordering::SeqCst);
                    break;
                }
                _ => {}
            }
        }
    });

    Ok(DbServerProcess {
        child,
        exited,
        port,
        shutdown_token,
    })
}

/// Asks the server to close the database and exit. An HTTP request rather
/// than SIGTERM, because Windows has no signals to send.
fn request_shutdown(port: u16, token: &str) -> std::io::Result<()> {
    let address = SocketAddr::from(([127, 0, 0, 1], port));
    let mut stream = TcpStream::connect_timeout(&address, SHUTDOWN_CONNECT_TIMEOUT)?;
    write!(
        stream,
        "POST /shutdown HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\nX-Shutdown-Token: {token}\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"
    )?;
    stream.flush()
}

/// Returns whether the process exited before the timeout.
fn wait_for_exit(exited: &AtomicBool) -> bool {
    let deadline = Instant::now() + SHUTDOWN_EXIT_TIMEOUT;
    while Instant::now() < deadline {
        if exited.load(Ordering::SeqCst) {
            return true;
        }
        thread::sleep(SHUTDOWN_POLL_INTERVAL);
    }
    exited.load(Ordering::SeqCst)
}

fn shutdown_db_server(process: DbServerProcess) {
    let DbServerProcess {
        child,
        exited,
        port,
        shutdown_token,
    } = process;
    let pid = child.pid();
    println!("Initiating database server shutdown (PID: {})...", pid);

    match request_shutdown(port, &shutdown_token) {
        Ok(()) => {
            println!("Requested database server shutdown, waiting for it to exit...");
            if wait_for_exit(&exited) {
                println!("Database server shut down gracefully.");
                return;
            }
            println!("Database server did not exit in time, forcing shutdown...");
        }
        Err(e) => {
            eprintln!("Failed to request shutdown: {}, forcing shutdown...", e);
        }
    }

    match child.kill() {
        Ok(_) => println!("Database server terminated successfully (PID: {}).", pid),
        Err(e) => eprintln!("Failed to kill database server (PID: {}): {}", pid, e),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .manage(DbServer(Mutex::new(None)))
        .setup(|app| {
            let handle = app.handle();

            // Start the database server sidecar
            match start_db_server(handle) {
                Ok(process) => {
                    let pid = process.child.pid();
                    let state = handle.state::<DbServer>();
                    *state.0.lock().unwrap() = Some(process);
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
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            if let tauri::RunEvent::Exit = event {
                // Kill the database server when the app exits
                println!("Application exit detected, cleaning up...");
                if let Some(state) = app_handle.try_state::<DbServer>() {
                    if let Ok(mut child_lock) = state.0.lock() {
                        if let Some(process) = child_lock.take() {
                            shutdown_db_server(process);
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
