//! {{APP_DISPLAY_NAME}} — Tauri entry point.
//! The Rust backend exposes commands to the frontend via IPC.
//! Keep commands minimal and validate all frontend input.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;

use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            // App metadata is available via app.package_info().
            let _ = app.get_webview_window("main");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![commands::get_app_info])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
