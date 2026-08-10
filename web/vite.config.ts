import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Backend routes are served under /api/... — pass the URI through unchanged.
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      // Same-origin passthrough for the remaining backend endpoints.
      '/health': 'http://localhost:3000',
      '/metrics': 'http://localhost:3000',
      '/swagger-ui': 'http://localhost:3000',
      '/api-docs': 'http://localhost:3000',
    },
  },
});