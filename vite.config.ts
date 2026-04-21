import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
    include: ['phaser'],
  },
  define: {
    CANVAS_RENDERER: JSON.stringify(true),
    WEBGL_RENDERER: JSON.stringify(true),
  },
});
