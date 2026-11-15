/// <reference types="vite/client" />
import type { WinForgeApi } from '../../shared/types.js';

declare global {
  interface Window {
    winforge: WinForgeApi;
  }
}
