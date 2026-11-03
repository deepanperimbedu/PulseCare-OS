import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

const BACKEND_FALLBACK_ORIGIN = 'http://localhost:5000';

function resolveProxyTarget(value: string | undefined): string {
  const normalized = (value ?? '').trim().replace(/\/+$/, '').replace(/\/api\/?$/, '');
  if (/^https?:\/\//i.test(normalized)) return normalized;
  return BACKEND_FALLBACK_ORIGIN;
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const proxyTarget = resolveProxyTarget(env.VITE_API_BASE_URL || env.VITE_SOCKET_URL);
  const proxy = {
    '/api': { target: proxyTarget, changeOrigin: true },
    '/socket.io': { target: proxyTarget, ws: true, changeOrigin: true },
  };

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
    },
    server: {
      port: 3000,
      proxy,
    },
    preview: {
      port: 3000,
      proxy,
    },
  };
});
