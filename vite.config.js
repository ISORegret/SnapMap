import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => ({
  root: __dirname,
  envDir: __dirname,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'SnapMap',
        short_name: 'SnapMap',
        description: 'Find and save photography & automotive spots. Map, favorites, best times.',
        theme_color: '#0a0a0f',
        background_color: '#0a0a0f',
        display: 'standalone',
        start_url: mode === 'android' ? './index.html' : (process.env.BASE_PATH || '/'),
        scope: mode === 'android' ? './' : (process.env.BASE_PATH || '/'),
        icons: [
          { src: '/favicon.svg', type: 'image/svg+xml', sizes: 'any', purpose: 'any' },
          { src: '/favicon.svg', type: 'image/svg+xml', sizes: 'any', purpose: 'maskable' },
        ],
      },
      workbox: {
        // In dev, dev-dist only has sw.js + workbox-*.js; include workbox so the glob matches and the warning goes away
        globPatterns: mode === 'development' ? ['**/workbox-*.js'] : ['**/*.{js,css,html,ico,svg,woff2}'],
        globIgnores: mode === 'development' ? ['**/node_modules/**/*'] : ['**/node_modules/**/*', 'sw.js', 'workbox-*.js'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/unpkg\.com\/leaflet.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'leaflet-cache', expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 30 } },
          },
          {
            urlPattern: /^https:\/\/[abc]\.tile\.openstreetmap\.org\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'osm-tiles', expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 } },
          },
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'google-fonts', expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
          {
            urlPattern: /^https:\/\/api\.open-meteo\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'open-meteo', expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 } },
          },
        ],
      },
      devOptions: { enabled: true },
    }),
  ],
  base: process.env.BASE_PATH || (mode === 'android' ? './' : '/'),
  build: {
    outDir: 'dist',
  },
}));
