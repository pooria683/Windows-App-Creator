/**
 * Vanilla TypeScript renderer — no framework, still fully typed.
 * DOM is built with textContent (never innerHTML) to avoid injection.
 */
import './style.css';
import { getAppInfo } from './bridge.js';

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  text?: string,
  className?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

async function render(): Promise<void> {
  const root = document.getElementById('root');
  if (!root) return;

  const main = el('main', undefined, 'app');
  main.append(el('h1', '{{APP_DISPLAY_NAME}}'), el('p', '{{DESCRIPTION}}', 'tagline'));

  try {
    const info = await getAppInfo();
    main.append(el('p', `v${info.version} · ${info.platform}`, 'meta'));
  } catch {
    main.append(el('p', 'Running in browser preview (bridge unavailable).', 'meta'));
  }

  const hint = el('p', undefined, 'hint');
  const code = el('code', 'src/renderer/src/main.ts');
  hint.append('Edit ', code, ' to build your UI. Hot reload is enabled in dev.');
  main.append(hint);

  root.replaceChildren(main);
}

void render();
