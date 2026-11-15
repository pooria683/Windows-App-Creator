/**
 * Renderer-side bridge to the Rust backend.
 * Only commands registered with `tauri::generate_handler!` are callable,
 * and only permissions listed in `src-tauri/capabilities/` are granted.
 */
import { invoke } from '@tauri-apps/api/core';
import type { AppInfo } from '../../shared/types.js';

export function getAppInfo(): Promise<AppInfo> {
  return invoke<AppInfo>('get_app_info');
}
