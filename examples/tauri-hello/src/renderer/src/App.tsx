import { useEffect, useState } from 'react';
import { getAppInfo } from './bridge.js';
import type { AppInfo } from '../../shared/types.js';

/**
 * Hello Tauri — main frontend component.
 * Calls Rust commands via Tauri IPC (`invoke`). No Node.js access.
 */
export default function App() {
  const [info, setInfo] = useState<AppInfo | null>(null);

  useEffect(() => {
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
        <p className="meta">Running in browser preview (Tauri IPC unavailable).</p>
      )}
      <p className="hint">
        Edit <code>src/renderer/src/App.tsx</code> and <code>src-tauri/src/commands.rs</code> to
        build your app.
      </p>
    </main>
  );
}
