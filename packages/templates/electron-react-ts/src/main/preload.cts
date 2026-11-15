/**
 * Electron preload script — the ONLY bridge between the privileged main
 * process and the sandboxed renderer.
 *
 * Security model:
 * - contextIsolation: true + sandbox: true (see main.ts)
 * - nodeIntegration: false — the renderer has NO direct Node access
 * - Only the explicit `window.winforge` API below is exposed.
 * Never expose raw `ipcRenderer`, `fs`, or `shell` to the renderer.
 *
 * NOTE: this file is deliberately `.cts` (compiled to CommonJS) because
 * sandboxed preload scripts cannot be ES modules.
 */
import { contextBridge, ipcRenderer } from 'electron';
import type { WinForgeApi } from '../shared/types.js';

const api: WinForgeApi = {
  getAppInfo: () => ipcRenderer.invoke('app:getInfo'),
  openExternal: (url: string) => ipcRenderer.invoke('app:openExternal', url),
};

contextBridge.exposeInMainWorld('winforge', api);
