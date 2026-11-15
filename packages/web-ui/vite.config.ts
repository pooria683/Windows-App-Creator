import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Bind to 0.0.0.0 and allow any host so the sandbox/cloud preview works.
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 4173,
    strictPort: true,
    allowedHosts: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    allowedHosts: true,
  },
});
