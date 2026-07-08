import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const projectDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  // Resolve project root and .env from this config's own directory, so the app
  // works regardless of the working directory Vite is launched from.
  root: projectDir,
  envDir: projectDir,
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 8080,
  },
  preview: {
    host: '0.0.0.0',
    port: 8080,
    allowedHosts: true,
  },
});