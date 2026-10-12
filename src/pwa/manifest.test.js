// Unit tests for the Gig Master Live web app manifest (Phase 2 PWA).
//
// Asserts the manifest declares the install-critical fields and icon set so
// iPadOS can "Add to Home Screen" and launch standalone at /live. We import the
// plain manifest module directly (not vite.config.js) to avoid pulling in the
// Vite plugin graph under vitest. vite.config.js imports this same object, so
// these assertions cover what the build emits to dist/manifest.webmanifest.
// (Req 5.1, 5.3, 5.4)
import { describe, it, expect } from 'vitest'

import manifest from './manifest'

describe('Gig Master Live web app manifest', () => {
  it('declares the install-critical identity and launch fields (Req 5.1, 5.3)', () => {
    expect(manifest.name).toBe('Gig Master Live')
    expect(manifest.short_name).toBe('GM Live')
    expect(manifest.display).toBe('standalone')
    expect(manifest.start_url).toBe('/live')
    expect(manifest.theme_color).toBe('#16132a')
    expect(manifest.background_color).toBe('#16132a')
  })

  it('includes a 192, a 512, and a maskable 512 icon (Req 5.1, 5.4)', () => {
    expect(Array.isArray(manifest.icons)).toBe(true)

    const has192 = manifest.icons.some((icon) => icon.sizes === '192x192')
    const has512 = manifest.icons.some((icon) => icon.sizes === '512x512')
    const hasMaskable512 = manifest.icons.some(
      (icon) =>
        icon.sizes === '512x512' &&
        typeof icon.purpose === 'string' &&
        icon.purpose.split(/\s+/).includes('maskable'),
    )

    expect(has192).toBe(true)
    expect(has512).toBe(true)
    expect(hasMaskable512).toBe(true)
  })
})
