import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In development, Vite proxies all /api/* requests to the Express backend.
// This makes the frontend appear same-origin from the browser's perspective,
// which lets the OTel exporter POST OTLP spans to /api/otel-proxy/v1/traces
// without hitting CORS.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
