/**
 * Shared types between main and renderer processes.
 * Keep this file free of Node/Electron imports so it can be used
 * safely in the renderer (via the preload bridge).
 */

/** App metadata returned by the main process. */
export interface AppInfo {
  name: string;
  version: string;
  platform: string;
}

/** API exposed to the renderer via contextBridge (see preload.cts). */
export interface WinForgeApi {
  /** Returns app metadata (name, version) — safe to expose. */
  getAppInfo(): Promise<AppInfo>;
  /** Opens an external URL in the system browser (validated). */
  openExternal(url: string): Promise<void>;
}
