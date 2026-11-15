/**
 * Electron main process — creates the BrowserWindow with secure defaults.
 *
 * Security defaults (do not weaken without a documented reason):
 * - contextIsolation: true
 * - nodeIntegration: false
 * - sandbox: true
 * - preload: contextBridge-only API (see preload.ts)
 */
import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = !app.isPackaged;
const DEV_URL = process.env['VITE_DEV_SERVER_URL'] ?? 'http://127.0.0.1:5173';

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 800,
    minHeight: 600,
    autoHideMenuBar: true,
    webPreferences: {
      // Sandboxed preloads must be CommonJS — see preload.cts.
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Open external links in the system browser, never in-app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) {
      void shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  if (isDev) {
    // Vite's dev server needs inline scripts + websocket HMR, so the strict
    // production CSP would break it. Dev-only relaxation, never packaged.
    win.webContents.session.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            "default-src 'self' 'unsafe-inline' data:; script-src 'self' 'unsafe-inline' 'unsafe-eval' http://127.0.0.1:5173; connect-src 'self' ws://127.0.0.1:5173 http://127.0.0.1:5173",
          ],
        },
      });
    });
    void win.loadURL(DEV_URL);
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    void win.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
}

// --- IPC handlers (validate all renderer input) ---
ipcMain.handle('app:getInfo', () => ({
  name: app.getName(),
  version: app.getVersion(),
  platform: process.platform,
}));

ipcMain.handle('app:openExternal', async (_event, url: unknown) => {
  if (typeof url !== 'string' || !url.startsWith('https://')) {
    throw new Error('Only https:// URLs can be opened externally.');
  }
  await shell.openExternal(url);
});

void app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
