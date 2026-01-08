// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    let session_type = std::env::var("XDG_SESSION_TYPE").unwrap_or_else(|_| "unknown".into());

    let load_env = |filename: &str| {
        let path = std::path::Path::new(filename);
        if path.exists() {
            match dotenvy::from_path(path) {
                Ok(_) => println!("Loaded {}", filename),
                Err(e) => eprintln!("Failed to load {}: {}", filename, e),
            }
        } else {
            let alt_path = std::path::Path::new("src-tauri").join(filename);
            if alt_path.exists() {
                match dotenvy::from_path(alt_path) {
                    Ok(_) => println!("Loaded src-tauri/{}", filename),
                    Err(e) => eprintln!("Failed to load src-tauri/{}: {}", filename, e),
                }
            } else {
                eprintln!("Could not find {} or src-tauri/{}", filename, filename);
            }
        }
    };

    if session_type == "wayland" {
        load_env(".env.wayland");
    }

    if session_type == "x11" {
        load_env(".env.x11");
    }

    unhussle_lib::run()
}
