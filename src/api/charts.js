import api, { resolveApiBaseUrl } from './axiosInstance'

// Song Charts API client (R7–R10, R13). Thin wrapper over the shared axios
// instance — the request interceptor attaches the Bearer token and X-Band-Id
// automatically, so no headers are set here. Each function returns the axios
// promise, matching the style of playlists.js / admin.js.

// GET /songs/:id/chart — stored chart (canonical Numbers body + metadata).
// 404 CHART_NOT_FOUND when the song has no chart (R7.2, R7.5).
export const getChart = (songId) =>
  api.get(`/songs/${songId}/chart`)

// PUT /songs/:id/chart — create or replace the chart (upsert, 1:1 per song).
// `enteredKey` tells the server how to interpret `body`: "Numbers" stores the
// ChordPro body as-is; a key name runs names→numbers before storing (R7.1,
// R7.4, R3, R4). Title and artist are Song properties and are NOT chart-
// overridable, so they are never part of this payload.
export const saveChart = (songId, { enteredKey, body, formatting }) =>
  api.put(`/songs/${songId}/chart`, { enteredKey, body, formatting })

// DELETE /songs/:id/chart — remove the chart (R7.3).
export const deleteChart = (songId) =>
  api.delete(`/songs/${songId}/chart`)

// GET /songs/:id/chart/view?key=<Numbers|KEY> — persisted chart rendered as a
// Render_Representation. `key=Numbers`/omitted → stored degrees; a key →
// server-transposed names (R8). Passing `key` undefined simply omits the param.
export const viewChart = (songId, { key } = {}) =>
  api.get(`/songs/${songId}/chart/view`, { params: { key } })

// POST /songs/:id/chart/view — un-persisted live preview for the editor. Takes
// a working (un-saved) body plus how to interpret it (`enteredKey`) and how to
// render it (`displayedKey`); returns the Render_Representation without saving
// (R8.4; design "Frontend — Editor" live preview).
export const previewChart = (songId, { body, enteredKey, displayedKey, formatting }) =>
  api.post(`/songs/${songId}/chart/view`, { body, enteredKey, displayedKey, formatting })

// GET /playlists/:id/charts?key=<Numbers|KEY> — batch Render_Representation for
// a playlist's songs; un-charted songs carry `null` (R10).
export const listPlaylistCharts = (playlistId, { key } = {}) =>
  api.get(`/playlists/${playlistId}/charts`, { params: { key } })

// --- PDF download (R9 server-side generation, R13 viewer download) ---
//
// The PDF endpoint (GET /songs/:id/chart/pdf) is band-scoped and relies on the
// Authorization + X-Band-Id headers that the axios interceptor attaches. A
// plain <a href> / window.open cannot carry those headers, so a direct link to
// this URL would hit the server unauthenticated. Two helpers are provided:
//
//   chartPdfUrl    — composes the absolute path+query for reference/display
//                    only. It is NOT authenticated on its own and must not be
//                    used as the sole mechanism for a download anchor.
//   downloadChartPdf — the approach that actually works with auth: fetch the
//                    PDF through the axios instance (so headers are attached) as
//                    a Blob. The component (task 11) turns the Blob into an
//                    object URL and triggers the download. PREFER THIS.

// Compose the absolute PDF URL (baseURL + path + optional ?key). Reference use
// only — does not carry auth headers; see downloadChartPdf for the working path.
export const chartPdfUrl = (songId, { key } = {}) => {
  const base = resolveApiBaseUrl().replace(/\/+$/, '')
  const path = `${base}/songs/${songId}/chart/pdf`
  return key ? `${path}?key=${encodeURIComponent(key)}` : path
}

// GET /songs/:id/chart/pdf as a Blob through the authenticated axios instance.
// Returns the axios promise; `response.data` is the PDF Blob the viewer can turn
// into an object URL to trigger a download (R13). This is the auth-safe path.
export const downloadChartPdf = (songId, { key } = {}) =>
  api.get(`/songs/${songId}/chart/pdf`, { params: { key }, responseType: 'blob' })
