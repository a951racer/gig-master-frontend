// Generates placeholder PWA icon PNGs for Gig Master Live.
//
// These are PLACEHOLDERS — simple solid brand-colored squares with a small
// contrasting inner square to read as an app icon. Replace with real artwork
// before launch. We encode valid PNGs by hand (zlib + CRC32) so no binary image
// dependency (sharp/canvas) is required in the build/dev toolchain.
//
// Run once:  node scripts/generate-pwa-icons.js
// Outputs:
//   public/icons/icon-192.png          (192x192, brand square)
//   public/icons/icon-512.png          (512x512, brand square)
//   public/icons/icon-512-maskable.png (512x512, extra safe-zone padding)
//   public/apple-touch-icon.png        (180x180, for iPad Add-to-Home-Screen)

import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const publicDir = join(__dirname, '..', 'public')
const iconsDir = join(publicDir, 'icons')

// Gig Master brand colors.
const BG = [0x16, 0x13, 0x2a] // #16132a dark background
const FG = [0x7c, 0x3a, 0xed] // #7c3aed purple glyph block

// --- Minimal PNG encoder (RGBA, no filter) ---------------------------------

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    t[n] = c >>> 0
  }
  return t
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  }
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii')
  const lenBuf = Buffer.alloc(4)
  lenBuf.writeUInt32BE(data.length, 0)
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf])
}

// paint(x, y) -> [r, g, b, a]
function encodePng(size, paint) {
  const bytesPerPixel = 4
  const stride = size * bytesPerPixel
  // Raw image data: each scanline prefixed with a filter-type byte (0 = none).
  const raw = Buffer.alloc((stride + 1) * size)
  for (let y = 0; y < size; y++) {
    const rowStart = y * (stride + 1)
    raw[rowStart] = 0 // filter: none
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = paint(x, y)
      const p = rowStart + 1 + x * bytesPerPixel
      raw[p] = r
      raw[p + 1] = g
      raw[p + 2] = b
      raw[p + 3] = a
    }
  }

  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0) // width
  ihdr.writeUInt32BE(size, 4) // height
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type: RGBA
  ihdr[10] = 0 // compression
  ihdr[11] = 0 // filter
  ihdr[12] = 0 // interlace

  const idat = deflateSync(raw)

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// Draw a brand background with a centered contrasting square glyph block.
// `inset` is the fraction of the canvas kept as padding around the glyph —
// maskable icons use a larger inset so content stays inside the safe zone.
function makePainter(inset) {
  return (size) => {
    const pad = Math.round(size * inset)
    const lo = pad
    const hi = size - pad
    return (x, y) => {
      if (x >= lo && x < hi && y >= lo && y < hi) {
        return [...FG, 0xff]
      }
      return [...BG, 0xff]
    }
  }
}

const glyph = makePainter(0.22) // standard icons
const maskableGlyph = makePainter(0.3) // extra safe-zone padding

mkdirSync(iconsDir, { recursive: true })

const outputs = [
  { file: join(iconsDir, 'icon-192.png'), size: 192, paint: glyph },
  { file: join(iconsDir, 'icon-512.png'), size: 512, paint: glyph },
  { file: join(iconsDir, 'icon-512-maskable.png'), size: 512, paint: maskableGlyph },
  { file: join(publicDir, 'apple-touch-icon.png'), size: 180, paint: glyph },
]

for (const { file, size, paint } of outputs) {
  const png = encodePng(size, paint(size))
  writeFileSync(file, png)
  // eslint-disable-next-line no-console
  console.log(`wrote ${file} (${size}x${size}, ${png.length} bytes)`)
}
