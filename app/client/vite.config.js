import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Proxies /api to the Node server during local dev, so the frontend can
// call relative paths (e.g. fetch('/api/inventory')) the same way in
// dev and in production, where Express serves the built client itself.
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
  build: {
    rollupOptions: {
      output: {
        // Split the two heaviest, rarely-changing dependencies into their
        // own chunks so a route/logic change doesn't force merchants to
        // re-download Polaris + recharts, and so no single chunk trips
        // Vite's 500kb bundle-size warning.
        manualChunks: {
          polaris: ['@shopify/polaris', '@shopify/polaris-icons'],
          charts: ['recharts'],
        },
      },
    },
  },
});
