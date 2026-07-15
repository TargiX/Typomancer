import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const projectDir = dirname(fileURLToPath(import.meta.url));

const localGeminiApi = (mode: string): Plugin => ({
  name: 'local-gemini-api',
  apply: 'serve',
  configureServer(server) {
    const env = loadEnv(mode, projectDir, '');

    server.middlewares.use(async (req, res, next) => {
      if (req.method !== 'POST' || req.url?.split('?', 1)[0] !== '/api/gemini') {
        next();
        return;
      }

      if (!process.env.GEMINI_API_KEY) {
        process.env.GEMINI_API_KEY = env.GEMINI_API_KEY || env.VITE_GEMINI_API_KEY;
      }

      try {
        const module = await server.ssrLoadModule('/api/gemini.ts');
        const handler = module.default as ((request: typeof req, response: typeof res) => Promise<unknown>) | undefined;

        if (typeof handler !== 'function') {
          throw new TypeError('api/gemini.ts does not export a default handler');
        }

        await handler(req, res);
      } catch (error) {
        next(error);
      }
    });
  },
});

export default defineConfig(({ mode }) => ({
  // Resolve project root and .env from this config's own directory, so the app
  // works regardless of the working directory Vite is launched from.
  root: projectDir,
  envDir: projectDir,
  plugins: [react(), localGeminiApi(mode)],
  server: {
    host: '0.0.0.0',
    port: 8080,
  },
  preview: {
    host: '0.0.0.0',
    port: 8080,
    allowedHosts: true,
  },
}));
