import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Nannymud',
        short_name: 'Nannymud',
        description: "Little Fighter of Lysator — 15 guilds, one arena",
        theme_color: '#000000',
        background_color: '#000000',
        display: 'standalone',
        orientation: 'landscape',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,wasm}'],
        runtimeCaching: [
          {
            urlPattern: /\/sprites\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'sprites',
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            urlPattern: /\/vfx\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'vfx',
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            urlPattern: /\/world\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'world',
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            urlPattern: /fonts\.googleapis\.com|fonts\.gstatic\.com/,
            handler: 'CacheFirst',
            options: { cacheName: 'fonts', expiration: { maxEntries: 10 } },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@nannymud/shared': path.resolve(__dirname, 'packages/shared/src'),
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
    include: ['phaser'],
  },
  define: {
    CANVAS_RENDERER: JSON.stringify(true),
    WEBGL_RENDERER: JSON.stringify(true),
  },
});
