import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const LOCAL_API_TARGET = 'http://127.0.0.1:8000';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 3000,
    strictPort: true,
    proxy: {
      '/config': {
        target: LOCAL_API_TARGET,
        changeOrigin: true,
      },
      '/remove-background': {
        target: LOCAL_API_TARGET,
        changeOrigin: true,
      },
    },
  },
});
