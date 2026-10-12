import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import manifest from './src/pwa/manifest.js'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // New deploys install the fresh service worker and take over on the next
      // load, so the cached app shell never goes stale indefinitely (Req 6.5).
      registerType: 'autoUpdate',
      // Non-fingerprinted assets to copy through and precache alongside the
      // hashed build output (icons are referenced by the manifest).
      includeAssets: [
        'favicon.svg',
        'apple-touch-icon.png',
        'icons/icon-192.png',
        'icons/icon-512.png',
        'icons/icon-512-maskable.png',
      ],
      workbox: {
        // Precache the built app shell: hashed JS/CSS, index.html, and icons so
        // the app loads offline after the first visit (Req 6.1).
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2}'],
        // Runtime config is environment-specific and injected at deploy time;
        // it must always come from the network, never a stale precache entry.
        globIgnores: ['**/config.js'],
        // SPA routes (e.g. /live, /live/gigs/:id/play) resolve to the app shell
        // when navigated offline (Req 6.1).
        navigateFallback: '/index.html',
        // Do not hijack the runtime config request with the SPA fallback — let
        // it hit the network so each environment gets its own config.
        navigateFallbackDenylist: [/^\/config\.js$/],
        // NOTE: no runtime caching rule for POST /playlists/:id/charts — POSTs
        // aren't cacheable by Workbox; offline chart data is handled by the
        // IndexedDB chart cache (useGigCharts), not the service worker.
      },
      // Single source of truth lives in src/pwa/manifest.js so it can be
      // unit-tested without importing this plugin graph (Req 5.1, 5.3, 5.4).
      manifest,
      // Keep the SW inert during `vite dev` so the dev server and the vitest
      // (jsdom) suite are unaffected; SW/manifest are only emitted by `build`.
      devOptions: {
        enabled: false,
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
    passWithNoTests: true,
  },
})
