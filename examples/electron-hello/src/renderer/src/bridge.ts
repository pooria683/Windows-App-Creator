/**
 * Renderer-side bridge to the main process.
 * The renderer is sandboxed (no Node, no ipcRenderer) — everything goes
 * through the narrow API exposed by the preload script.
 */
import type { AppInfo } from '../../shared/types.js';

export function getAppInfo(): Promise<AppInfo> {
  if (!window.winforge) {
    return Promise.reject(new Error('Electron bridge unavailable (running in a plain browser?)'));
  }
  return window.winforge.getAppInfo();
}
