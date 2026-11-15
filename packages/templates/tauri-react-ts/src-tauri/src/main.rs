//! {{APP_DISPLAY_NAME}} — Tauri entry point.
//!
//! The Rust side exposes a deliberately small surface: only commands listed in
//! `tauri::generate_handler!` are callable from the frontend, and only the
//! permissions in `capabilities/default.json` are granted to the window.
//! Add new commands to `commands.rs`, register them here, and validate every
//! argument inside the command itself.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![commands::get_app_info])
        .run(tauri::generate_context!())
        .expect("error while running the Tauri application");
}
