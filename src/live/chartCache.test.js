// Tests for the IndexedDB-backed chart cache (Gig Master Live, Phase 2).
//
// IndexedDB isn't available in jsdom, so we install `fake-indexeddb/auto` at the
// VERY TOP — before importing chartCache — so a global `indexedDB` exists by the
// time the module's lazy `openDB()` first runs.
import 'fake-indexeddb/auto'

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fc from 'fast-check'

import {
  cacheKey,
  putCharts,
  getCharts,
  clearCharts,
  MAX_GIGS,
} from './chartCache'

// chartCache opens a SINGLE shared DB connection and keeps it for the whole test
// run. The schema (object store + index) is created once on first open and then
// reused; we only need to wipe the rows between tests. `clearCharts()` empties
// the `liveCharts` store, which is enough to isolate every test from the next.
beforeEach(async () => {
  await clearCharts()
})

// A representative charts payload: the shape useGigCharts / ChartPages consume.
function sampleCharts() {
  return [
    { songId: 's1', title: 'Blue Monk', playedKey: 'Bb', chart: '<div>Bb7 Eb7</div>' },
    { songId: 's2', title: "Autumn Leaves", playedKey: 'G', chart: '<div>Am7 D7</div>' },
    { songId: 's3', title: 'So What', playedKey: 'D', chart: '<div>Dm7</div>' },
  ]
}

function selectionsA() {
  return [
    { songId: 's1', mode: 'numbers' },
    { songId: 's2', mode: 'chords' },
    { songId: 's3', mode: 'numbers' },
  ]
}

function selectionsB() {
  return [
    { songId: 's1', mode: 'chords' },
    { songId: 's2', mode: 'chords' },
    { songId: 's3', mode: 'chords' },
  ]
}

describe('chartCache', () => {
  // ---------------------------------------------------------------------------
  // Example-based tests
  // ---------------------------------------------------------------------------

  // Design Property 1 / Req 6.2, 6.3: put then get for the same gig+selections
  // returns an entry whose charts deep-equal the stored charts, with truncated
  // preserved.
  it('round-trip: putCharts then getCharts returns the stored charts and truncated', async () => {
    const gigId = 'gig-1'
    const selections = selectionsA()
    const charts = sampleCharts()

    await putCharts({ gigId, selections, charts, truncated: true })
    const entry = await getCharts(gigId, selections)

    expect(entry).not.toBeNull()
    expect(entry.charts).toEqual(charts)
    expect(entry.truncated).toBe(true)
    expect(entry.gigId).toBe(gigId)
  })

  // Req 6.3 / 6.4: an unknown gig+selections is a miss (null), never a throw.
  it('miss: getCharts for an unknown gig/selections returns null', async () => {
    const entry = await getCharts('nope-gig', selectionsA())
    expect(entry).toBeNull()
  })

  // Writing the same key twice updates in place: the latest charts win and the
  // store still holds a single entry for that key.
  it('overwrite: putCharts twice for the same key updates in place', async () => {
    const gigId = 'gig-ow'
    const selections = selectionsA()
    const first = sampleCharts()
    const second = [{ songId: 's9', title: 'New Tune', playedKey: 'C', chart: '<div>C</div>' }]

    await putCharts({ gigId, selections, charts: first, truncated: false })
    await putCharts({ gigId, selections, charts: second, truncated: true })

    const entry = await getCharts(gigId, selections)
    expect(entry.charts).toEqual(second)
    expect(entry.truncated).toBe(true)

    // Only ONE entry exists for this gig+selections (overwrite, not append): a
    // second distinct-selection key would be a different entry, so a get for a
    // different selection set is a miss.
    const other = await getCharts(gigId, selectionsB())
    expect(other).toBeNull()
  })

  // Design Property 2 / Req 6.2: different selection sets map to different keys,
  // and loading S2 never returns S1's cached charts.
  it('key isolation: different selections produce different keys and never cross-serve', async () => {
    const gigId = 'gig-iso'
    const S1 = selectionsA()
    const S2 = selectionsB()

    expect(cacheKey(gigId, S1)).not.toBe(cacheKey(gigId, S2))

    await putCharts({ gigId, selections: S1, charts: sampleCharts(), truncated: false })

    // S2 was never written for this gig -> miss, does NOT return S1's data.
    const entryS2 = await getCharts(gigId, S2)
    expect(entryS2).toBeNull()

    // S1 still resolves to its own data.
    const entryS1 = await getCharts(gigId, S1)
    expect(entryS1).not.toBeNull()
    expect(entryS1.charts).toEqual(sampleCharts())
  })

  // Design Property 2 (normalization): selection ORDER must not change the key,
  // so an incidental reorder of the same selection set still hits the cache.
  it('key normalization: selection order does not change the cache key', async () => {
    const gigId = 'gig-order'
    const a = { songId: 's1', mode: 'numbers' }
    const b = { songId: 's2', mode: 'chords' }

    expect(cacheKey(gigId, [a, b])).toBe(cacheKey(gigId, [b, a]))

    // And it actually hits: write with one order, read with the other.
    await putCharts({ gigId, selections: [a, b], charts: sampleCharts(), truncated: false })
    const entry = await getCharts(gigId, [b, a])
    expect(entry).not.toBeNull()
    expect(entry.charts).toEqual(sampleCharts())
  })

  // ---------------------------------------------------------------------------
  // Property-based tests (fast-check) — Design Correctness Properties 1 & 3.
  // ---------------------------------------------------------------------------

  describe('property-based', () => {
    // A JSON-serializable, modest charts payload generator.
    const chartArb = fc.array(
      fc.record({
        songId: fc.string({ minLength: 1, maxLength: 8 }),
        title: fc.string({ maxLength: 20 }),
        playedKey: fc.constantFrom('C', 'G', 'D', 'A', 'Bb', 'Eb', 'F'),
        chart: fc.string({ maxLength: 40 }),
      }),
      { maxLength: 5 },
    )

    const selectionsArb = fc.array(
      fc.record({
        songId: fc.string({ minLength: 1, maxLength: 6 }),
        mode: fc.constantFrom('numbers', 'chords'),
      }),
      { maxLength: 5 },
    )

    // Property 1: round-trip fidelity. For arbitrary gigId + charts + selections,
    // putCharts then getCharts yields charts deep-equal to the input.
    // **Validates: Requirements 6.2, 6.3**
    it('Property 1 — round-trip fidelity for arbitrary payloads', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 12 }),
          chartArb,
          selectionsArb,
          fc.boolean(),
          async (gigId, charts, selections, truncated) => {
            await clearCharts()
            await putCharts({ gigId, selections, charts, truncated })
            const entry = await getCharts(gigId, selections)
            expect(entry).not.toBeNull()
            expect(entry.charts).toEqual(charts)
            expect(entry.truncated).toBe(truncated)
          },
        ),
        { numRuns: 50 },
      )
    })

    // Property 3: bounded LRU. After storing more than MAX_GIGS distinct gigs,
    // the cache holds at most MAX_GIGS entries, and the entries that remain are
    // the most-recently-accessed ones (the evicted ones are the oldest).
    //
    // `putCharts` stamps lastAccessed = Date.now(); two writes within the same
    // millisecond would tie and make the eviction order ambiguous. To keep the
    // recency ordering deterministic we mock Date.now with a strictly
    // incrementing counter for this property, so each write/read gets a unique,
    // monotonically increasing timestamp.
    // **Validates: Requirements 6.6**
    it('Property 3 — bounded LRU keeps the most-recently-accessed MAX_GIGS', async () => {
      let clock = 1
      const nowSpy = vi.spyOn(Date, 'now').mockImplementation(() => clock++)

      try {
        await fc.assert(
          fc.asyncProperty(
            fc.integer({ min: MAX_GIGS + 1, max: MAX_GIGS + 6 }),
            async (n) => {
              await clearCharts()

              // Distinct gigs written in a known order g0, g1, ..., g(n-1).
              // Each later write has a strictly larger lastAccessed, so the
              // most-recently-written MAX_GIGS are the survivors and the first
              // (n - MAX_GIGS) are evicted.
              const gigIds = Array.from({ length: n }, (_, i) => `lru-gig-${i}`)
              const selections = selectionsA()

              for (const gigId of gigIds) {
                await putCharts({
                  gigId,
                  selections,
                  charts: [{ songId: 'x', title: gigId, playedKey: 'C', chart: '<i>c</i>' }],
                  truncated: false,
                })
              }

              const survivors = gigIds.slice(n - MAX_GIGS)
              const evicted = gigIds.slice(0, n - MAX_GIGS)

              // Count present entries directly by probing each key. We only count
              // the gigs we wrote (the store was cleared first), so this is the
              // total stored count.
              let presentCount = 0
              for (const gigId of gigIds) {
                const entry = await getCharts(gigId, selections)
                if (entry) presentCount += 1
              }
              expect(presentCount).toBeLessThanOrEqual(MAX_GIGS)

              // The most-recent MAX_GIGS are all present...
              for (const gigId of survivors) {
                // NB: the getCharts calls above refreshed lastAccessed for all
                // present entries uniformly in gig order, which does not change
                // membership (count is already within bound, so no eviction).
                const entry = await getCharts(gigId, selections)
                expect(entry).not.toBeNull()
              }
              // ...and the oldest, never-re-accessed ones were evicted.
              for (const gigId of evicted) {
                const entry = await getCharts(gigId, selections)
                expect(entry).toBeNull()
              }
            },
          ),
          { numRuns: 25 },
        )
      } finally {
        nowSpy.mockRestore()
      }
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })
})
