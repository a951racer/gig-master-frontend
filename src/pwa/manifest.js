// Web app manifest for Gig Master Live (Phase 2 PWA).
//
// Extracted from vite.config.js so there is a single source of truth that can
// be unit-tested WITHOUT importing Vite's plugin graph. vite.config.js imports
// this object and hands it to VitePWA as the `manifest` option, so the built
// dist/manifest.webmanifest is generated from exactly these values.
//
// Declares at least name, icons, display: standalone, start URL, and theme/
// background colors so iPadOS can install the app via "Add to Home Screen"
// (Req 5.1, 5.3, 5.4).
const manifest = {
  name: 'Gig Master Live',
  short_name: 'GM Live',
  description: 'Full-screen, offline-ready chart reader for live performances.',
  display: 'standalone',
  start_url: '/live',
  scope: '/',
  theme_color: '#16132a',
  background_color: '#16132a',
  icons: [
    {
      src: '/icons/icon-192.png',
      sizes: '192x192',
      type: 'image/png',
      purpose: 'any',
    },
    {
      src: '/icons/icon-512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'any',
    },
    {
      src: '/icons/icon-512-maskable.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'maskable',
    },
  ],
}

export default manifest
