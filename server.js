// Production static server for the built SPA (dist/).
//
// Replaces `serve -s dist`, which cannot force HTTPS. On Heroku, TLS is
// terminated at the router and BOTH http:// and https:// requests arrive at the
// dyno as plain HTTP with an `X-Forwarded-Proto` header indicating the original
// scheme. `serve` happily returned the app over http://, and on an insecure
// page the API's Secure; SameSite=None; Partitioned refresh cookie cannot be
// set/sent and the cross-origin credentialed login request is blocked as mixed
// content (observed as "Login failed" with no POST /auth/login reaching the API,
// notably on mobile browsers). This server redirects http -> https so the app
// is only ever used over a secure origin.
//
// Behavior:
//   - trust proxy (so req.secure / X-Forwarded-Proto are honored on Heroku)
//   - 301 redirect any non-HTTPS request to the https:// equivalent
//   - HSTS so browsers refuse http on subsequent visits
//   - serve dist/ statically with SPA fallback to index.html
//
// Locally (no X-Forwarded-Proto, not NODE_ENV=production) the redirect is a
// no-op so `npm start` still works over http://localhost.

import express from 'express'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const distDir = join(__dirname, 'dist')
const port = process.env.PORT || 4173

// Only enforce HTTPS when running behind a TLS-terminating proxy (Heroku sets
// X-Forwarded-Proto). This keeps local `npm start` over http://localhost working.
const enforceHttps = process.env.FORCE_HTTPS === 'true' || process.env.NODE_ENV === 'production'

const app = express()
app.set('trust proxy', true)

if (enforceHttps) {
  app.use((req, res, next) => {
    // req.secure reflects X-Forwarded-Proto when trust proxy is on.
    const proto = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http')
    if (proto !== 'https') {
      return res.redirect(301, `https://${req.headers.host}${req.originalUrl}`)
    }
    // Tell browsers to stick to HTTPS going forward (1 year, include subdomains).
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
    next()
  })
}

// Static assets. index.html is not cached hard so new deploys are picked up;
// hashed assets can be cached aggressively (Vite fingerprints them).
app.use(express.static(distDir, { index: false, maxAge: '1h' }))

// SPA fallback — every non-asset path serves index.html.
app.get('*', (req, res) => {
  res.sendFile(join(distDir, 'index.html'))
})

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`[server] serving dist/ on :${port} (enforceHttps=${enforceHttps})`)
})
