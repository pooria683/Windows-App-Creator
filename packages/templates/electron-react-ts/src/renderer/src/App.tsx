import { useEffect, useState } from 'react';
import { getAppInfo } from './bridge.js';
import type { AppInfo } from '../../shared/types.js';

/**
 * {{APP_DISPLAY_NAME}} — main renderer component.
 * Communicates with the main process ONLY via window.winforge
 * (see src/main/preload.cts). No Node.js APIs are available here.
 */
export default function App() {
  const [info, setInfo] = useState<AppInfo | null>(null);

  useEffect(() => {
    // The bridge talks to the main process through the preload API.
    // In a plain browser (vite dev) it degrades gracefully to null.
    getAppInfo()
      .then(setInfo)
      .catch(() => setInfo(null));
  }, []);

  return (
    <main className="app">
      <h1>{{ APP_DISPLAY_NAME }}</h1>
      <p className="tagline">{{ DESCRIPTION }}</p>
      {info ? (
        <p className="meta">
          v{info.version} · {info.platform}
        </p>
      ) : (
        <p className="meta">Running in browser preview (Electron bridge unavailable).</p>
      )}
      <p className="hint">
        Edit <code>src/renderer/src/App.tsx</code> to build your UI. Hot reload is enabled in dev.
      </p>
    </main>
  );
}
