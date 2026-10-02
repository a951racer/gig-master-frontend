// Writes dist/config.js from the runtime environment at dyno startup, so the
// deployed frontend reads its API URL at runtime instead of from a value baked
// into the bundle at build time (#8). Run before the static server starts (see
// the "start" script).
//
// Reads API_URL from the environment. If unset, writes an empty apiUrl so the
// app falls back to its build-time/localhost default (see axiosInstance.js).

import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

const apiUrl = process.env.API_URL || ''

// Serialize via JSON.stringify so the value is safely quoted/escaped.
const contents = `window.__APP_CONFIG__ = { apiUrl: ${JSON.stringify(apiUrl)} };\n`

const target = join(process.cwd(), 'dist', 'config.js')
writeFileSync(target, contents)

console.log(`[generate-config] wrote ${target} with apiUrl=${apiUrl ? apiUrl : '(empty — falling back to build-time/localhost)'}`)
