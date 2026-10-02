import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

// Mock the charts API layer so no network happens. The viewer calls
// `viewChart` on mount and on every Key change; `downloadChartPdf` is referenced
// by the (concurrently wired) PDF button, so it is stubbed too but not asserted.
vi.mock('../../api/charts', () => ({
  viewChart: vi.fn(),
  downloadChartPdf: vi.fn(),
}))

// Band context: a band is selected (band-scoped presentation, R12.5).
const currentBand = { id: 'b1', name: 'The Band' }
vi.mock('../../auth/BandContext', () => ({
  useBand: () => ({ currentBand, hasNoBand: false }),
}))

// Supply the route param `id` (songId) and a navigate stub, matching the
// project convention (see admin BandDetailPage.test.jsx).
const navigateMock = vi.fn()
vi.mock('react-router-dom', async (orig) => {
  const actual = await orig()
  return {
    ...actual,
    useParams: () => ({ id: 'song-1' }),
    useNavigate: () => navigateMock,
  }
})

import ChartViewerPage from './ChartViewerPage'
import { viewChart } from '../../api/charts'

const renderPage = () => render(<MemoryRouter><ChartViewerPage /></MemoryRouter>)

// A Render_Representation using Nashville degrees (what `Numbers` returns). The
// server resolves breaks into a `pages` structure: each page has `columns`,
// each column has `lines` (header / content / transpose). `sections` remains
// for back-compat but the viewer renders from `pages`.
const numbersRepresentation = {
  title: 'Amazing Grace',
  artist: 'John Newton',
  keyLabel: 'Numbers',
  formatting: { font: 'monospace', size: 11, chordColor: 'blue', columns: 1 },
  sections: [
    {
      label: 'Verse 1',
      repeat: null,
      lines: [
        {
          segments: [
            { chord: '1', lyric: 'A' },
            { chord: '4', lyric: 'ma' },
            { chord: '1', lyric: 'zing grace' },
          ],
        },
      ],
    },
  ],
  pages: [
    {
      columns: [
        {
          lines: [
            { header: { label: 'Verse 1', repeat: null } },
            {
              segments: [
                { chord: '1', lyric: 'A' },
                { chord: '4', lyric: 'ma' },
                { chord: '1', lyric: 'zing grace' },
              ],
              directive: null,
              transposeShift: null,
            },
          ],
        },
      ],
    },
  ],
}

// The same chart transposed into G — chord tokens are spelled names now.
const namesRepresentation = {
  title: 'Amazing Grace',
  artist: 'John Newton',
  keyLabel: 'G',
  formatting: { font: 'monospace', size: 11, chordColor: 'blue', columns: 1 },
  sections: [
    {
      label: 'Verse 1',
      repeat: null,
      lines: [
        {
          segments: [
            { chord: 'G', lyric: 'A' },
            { chord: 'C', lyric: 'ma' },
            { chord: 'G', lyric: 'zing grace' },
          ],
        },
      ],
    },
  ],
  pages: [
    {
      columns: [
        {
          lines: [
            { header: { label: 'Verse 1', repeat: null } },
            {
              segments: [
                { chord: 'G', lyric: 'A' },
                { chord: 'C', lyric: 'ma' },
                { chord: 'G', lyric: 'zing grace' },
              ],
              directive: null,
              transposeShift: null,
            },
          ],
        },
      ],
    },
  ],
}

beforeEach(() => {
  vi.clearAllMocks()
  viewChart.mockResolvedValue({ data: numbersRepresentation })
})

describe('ChartViewerPage (#12)', () => {
  it('renders the title+key banner, artist, section header and chord-over-lyric segments from the pages', async () => {
    renderPage()

    // Page 1 banner: "<title> [<keyLabel>]" and the artist name (no brackets).
    expect(await screen.findByText(/Amazing Grace \[Numbers\]/)).toBeInTheDocument()
    expect(screen.getByText('John Newton')).toBeInTheDocument()

    // Section header (rendered from the page's header line) + chord-over-lyric.
    expect(screen.getByRole('heading', { name: /Verse 1/i })).toBeInTheDocument()
    expect(screen.getByText('ma')).toBeInTheDocument()
    expect(screen.getByText('zing grace')).toBeInTheDocument()
  })

  it('shows the band-name footer on each page and a right-justified page number on pages 2+', async () => {
    // A two-page representation with a band name. Page 1 uses the banner (no
    // page number); page 2 uses the condensed header with "Page 2 of 2".
    viewChart.mockResolvedValueOnce({
      data: {
        title: 'Long One',
        artist: 'The Writers',
        bandName: 'Lonesome Dove',
        keyLabel: 'Numbers',
        formatting: { font: 'monospace', size: 11, chordColor: 'blue', columns: 1 },
        pages: [
          { columns: [ { lines: [ { header: { label: 'VERSE 1', repeat: null } } ] } ] },
          { columns: [ { lines: [ { header: { label: 'VERSE 2', repeat: null } } ] } ] },
        ],
      },
    })

    renderPage()

    // The band name footer appears once per page (2 pages → 2 occurrences).
    await waitFor(() => expect(screen.getAllByText('Lonesome Dove').length).toBe(2))
    // Page 2 carries a right-justified page indicator.
    expect(screen.getByText('Page 2 of 2')).toBeInTheDocument()
    // Page 1 (banner) does not show a page number.
    expect(screen.queryByText('Page 1 of 2')).not.toBeInTheDocument()
  })

  it('renders a chord quality as superscript (degree stays unambiguous)', async () => {
    // A representation whose segment carries structured chord parts: degree 4
    // with quality "5" (a D5 power chord). The quality must render in a <sup>
    // so "45" is not shown as one ambiguous number.
    viewChart.mockResolvedValueOnce({
      data: {
        title: 'Intro Only',
        artist: 'Someone',
        keyLabel: 'Numbers',
        formatting: { font: 'monospace', size: 11, chordColor: 'blue', columns: 1 },
        pages: [
          {
            columns: [
              {
                lines: [
                  {
                    segments: [
                      { chord: '45', root: '4', quality: '5', bass: null, lyric: ' ' },
                    ],
                    directive: null,
                    transposeShift: null,
                  },
                ],
              },
            ],
          },
        ],
      },
    })

    renderPage()

    // The quality "5" is rendered inside a <sup> element, separate from the "4".
    const sup = await waitFor(() => {
      const el = document.querySelector('sup')
      if (!el) throw new Error('no sup yet')
      return el
    })
    expect(sup.textContent).toBe('5')
  })

  it('defaults to Numbers: calls viewChart with { key: "Numbers" } on mount and shows degrees', async () => {
    renderPage()

    await waitFor(() =>
      expect(viewChart).toHaveBeenCalledWith('song-1', { key: 'Numbers' })
    )

    // The Key selector defaults to Numbers.
    const select = screen.getByLabelText('Key')
    expect(select).toHaveValue('Numbers')

    // Nashville degree chords are shown.
    expect(await screen.findByText('4')).toBeInTheDocument()
    expect(screen.getAllByText('1').length).toBeGreaterThan(0)
  })

  it('re-fetches with the chosen key and renders the transposed names when a key is selected', async () => {
    const user = userEvent.setup()
    renderPage()

    // Initial Numbers fetch resolves first.
    await screen.findByText('4')
    expect(viewChart).toHaveBeenCalledWith('song-1', { key: 'Numbers' })

    // Next fetch (triggered by the key change) returns names-in-G.
    viewChart.mockResolvedValueOnce({ data: namesRepresentation })

    await user.selectOptions(screen.getByLabelText('Key'), 'G')

    // The selection drives a re-fetch with the chosen key.
    await waitFor(() => expect(viewChart).toHaveBeenCalledWith('song-1', { key: 'G' }))

    // The key label updates in the banner once the names representation renders.
    expect(await screen.findByText(/Amazing Grace \[G\]/)).toBeInTheDocument()

    // Transposed chord names render as chord segments. Scope to the chord spans
    // so the Key selector's <option> values (which also read "C"/"G") are not
    // matched.
    const chordText = (name) =>
      screen.getAllByText(name).filter((el) => el.tagName !== 'OPTION')
    expect(chordText('C').length).toBeGreaterThan(0)
    expect(chordText('G').length).toBeGreaterThan(0)
  })

  it('renders within the provided current band (band-scoped presentation)', async () => {
    renderPage()

    // The chart renders (viewer is shown within the selected band) and the API
    // is called for the routed song in that band's scope.
    expect(await screen.findByText(/Amazing Grace \[Numbers\]/)).toBeInTheDocument()
    await waitFor(() => expect(viewChart).toHaveBeenCalledWith('song-1', { key: 'Numbers' }))
  })

  it('shows a "no chart yet" empty state when the API reports the chart is missing', async () => {
    viewChart.mockRejectedValueOnce({
      response: { status: 404, data: { error: { code: 'CHART_NOT_FOUND' } } },
    })

    renderPage()

    expect(await screen.findByText(/no chart yet/i)).toBeInTheDocument()
    // The chart body is not rendered in the empty state.
    expect(screen.queryByText(/Amazing Grace \[Numbers\]/)).not.toBeInTheDocument()
  })
})
