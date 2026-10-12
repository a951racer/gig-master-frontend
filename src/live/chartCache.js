// IndexedDB-backed cache for a gig's rendered charts, with LRU eviction.
//
// Gig Master Live offline support (Phase 2, Req 6.2 / 6.6). Charts are fetched
// via POST /playlists/:id/charts, which the Cache API / service worker cannot
// transparently cache. So offline chart storage is an application-level cache
// in IndexedDB, keyed by gig + a stable hash of the per-song selections.
//
// Dependency-free: raw IndexedDB wrapped in Promises (no idb / Workbox here).
//
// Stored entry shape (store `liveCharts`, keyPath `key`):
//   { key, gigId, selections, charts, truncated, cachedAt, lastAccessed }
//
// LRU interpretation: one entry per (gigId + selections) combination. The bound
// is on the TOTAL NUMBER OF ENTRIES (MAX_GIGS, default 10) — each cache entry
// counts as one unit regardless of gig. When a write pushes the count over the
// bound, the least-recently-accessed entries (lowest `lastAccessed`) are
// evicted until the count is back within the bound.

const DB_NAME = 'gigmaster-live'
const DB_VERSION = 1
const STORE = 'liveCharts'
const LAST_ACCESSED_INDEX = 'lastAccessed'

// Retention bound: keep at most this many cache entries (see LRU note above).
export const MAX_GIGS = 10

// --- Key derivation -------------------------------------------------------

// Small, stable 32-bit string hash (FNV-1a). Deterministic and dependency-free;
// used only to derive a compact, collision-resistant-enough cache key suffix.
function fnv1a(str) {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i)
    // h *= 16777619, kept in 32-bit unsigned range.
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}

// Stable hash of a selections array, independent of array order. Per-song order
// is already fixed upstream, but we normalize (sort by songId, then stringify
// the { songId, mode } pairs) so the key is robust to incidental reordering.
function hashSelections(selections) {
  const list = Array.isArray(selections) ? selections : []
  const normalized = list
    .map((s) => ({ songId: s?.songId, mode: s?.mode }))
    .sort((a, b) => String(a.songId).localeCompare(String(b.songId)))
  return fnv1a(JSON.stringify(normalized))
}

// Derive the cache key for a gig + selections. Exported so useGigCharts and
// tests derive keys the same way the cache does.
export function cacheKey(gigId, selections) {
  return `${gigId}:${hashSelections(selections)}`
}

// --- IndexedDB plumbing (promise wrappers) --------------------------------

// Resolve the IndexedDB factory, or null when unavailable (SSR / old / jsdom
// without a polyfill). Callers treat null as "no IndexedDB" and no-op/reject.
function getIndexedDB() {
  if (typeof indexedDB !== 'undefined') return indexedDB
  if (typeof globalThis !== 'undefined' && globalThis.indexedDB) return globalThis.indexedDB
  return null
}

// Lazily-opened singleton DB connection promise.
let dbPromise = null

function openDB() {
  if (dbPromise) return dbPromise

  dbPromise = new Promise((resolve, reject) => {
    const idb = getIndexedDB()
    if (!idb) {
      reject(new Error('IndexedDB is not available in this environment'))
      return
    }

    let request
    try {
      request = idb.open(DB_NAME, DB_VERSION)
    } catch (err) {
      reject(err)
      return
    }

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'key' })
        // Secondary index on lastAccessed makes LRU victim selection efficient.
        store.createIndex(LAST_ACCESSED_INDEX, 'lastAccessed', { unique: false })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error('IndexedDB open blocked'))
  })

  // Don't cache a rejected open — allow a later retry (e.g. after a polyfill
  // becomes available in tests).
  dbPromise.catch(() => {
    dbPromise = null
  })

  return dbPromise
}

// Wrap an IDBRequest in a Promise.
function promisifyRequest(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

// Run `work(store)` inside a transaction and resolve when the transaction
// completes (so writes are durable before the promise settles).
function runTransaction(db, mode, work) {
  return new Promise((resolve, reject) => {
    let tx
    try {
      tx = db.transaction(STORE, mode)
    } catch (err) {
      reject(err)
      return
    }
    const store = tx.objectStore(STORE)
    let result
    let workError = null

    try {
      result = work(store)
    } catch (err) {
      workError = err
      try {
        tx.abort()
      } catch {
        // ignore abort errors
      }
    }

    tx.oncomplete = () => resolve(result)
    tx.onabort = () => reject(workError || tx.error || new Error('Transaction aborted'))
    tx.onerror = () => reject(tx.error)
  })
}

// --- LRU eviction ---------------------------------------------------------

// Evict least-recently-accessed entries until the store holds at most MAX_GIGS.
// Reads all keys + their lastAccessed (fine for a small N), sorts ascending, and
// deletes the oldest overflow. Runs in its own readwrite transaction.
async function enforceBound(db) {
  const entries = await runTransaction(db, 'readonly', (store) => {
    const acc = []
    // getAll keeps this simple and is supported by fake-indexeddb + browsers.
    const req = store.getAll()
    req.onsuccess = () => {
      for (const e of req.result) {
        acc.push({ key: e.key, lastAccessed: e.lastAccessed ?? 0 })
      }
    }
    return acc
  })

  if (entries.length <= MAX_GIGS) return

  entries.sort((a, b) => a.lastAccessed - b.lastAccessed)
  const victims = entries.slice(0, entries.length - MAX_GIGS)

  await runTransaction(db, 'readwrite', (store) => {
    for (const v of victims) store.delete(v.key)
  })
}

// --- Public API -----------------------------------------------------------

// Write (or overwrite) the cache entry for a gig + selections, stamp timestamps,
// then enforce the LRU bound. Resolves to the stored entry. Rejects cleanly if
// IndexedDB is unavailable.
export async function putCharts({ gigId, selections, charts, truncated }) {
  const db = await openDB()
  const now = Date.now()
  const entry = {
    key: cacheKey(gigId, selections),
    gigId,
    selections,
    charts,
    truncated: truncated ?? false,
    cachedAt: now,
    lastAccessed: now,
  }

  await runTransaction(db, 'readwrite', (store) => {
    store.put(entry)
  })

  await enforceBound(db)
  return entry
}

// Read the cache entry for a gig + selections. On hit, write back a refreshed
// `lastAccessed` (so reads count toward recency for LRU) and resolve the full
// entry. On miss, resolve null. Rejects cleanly if IndexedDB is unavailable.
export async function getCharts(gigId, selections) {
  const db = await openDB()
  const key = cacheKey(gigId, selections)

  // `runTransaction` resolves with whatever `work` returns; returning the
  // promisified request means it resolves with the fetched record (or
  // undefined on a miss).
  const found = await runTransaction(db, 'readonly', (store) =>
    promisifyRequest(store.get(key)),
  )

  if (!found) return null

  found.lastAccessed = Date.now()
  await runTransaction(db, 'readwrite', (store) => {
    store.put(found)
  })

  return found
}

// Clear every entry in the store. Primarily a test/reset helper. Rejects
// cleanly if IndexedDB is unavailable.
export async function clearCharts() {
  const db = await openDB()
  await runTransaction(db, 'readwrite', (store) => {
    store.clear()
  })
}

export default { cacheKey, putCharts, getCharts, clearCharts, MAX_GIGS }
