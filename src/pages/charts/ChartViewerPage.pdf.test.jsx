import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

// Mock the charts API layer so no network happens. The viewer calls
// `viewChart` on mount / on every Key change, and `downloadChartPdf` when the
// Download PDF button is pressed. Both are stubbed; this file asserts on the
// PDF download path (R13.1–13.3).
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
// project convention (see ChartViewerPage.test.jsx).
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
import { viewChart, downloadChartPdf } from '../../api/charts'

const renderPage = () => render(<MemoryRouter><ChartViewerPage /></MemoryRouter>)

// A Render_Representation using Nashville degrees (what `Numbers` returns) so a
// chart renders and the Download PDF button is enabled. `title` drives the
// download filename.
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

// A tiny fake PDF blob the download helper resolves with.
const pdfBlob = new Blob(['%PDF-1.4 fake'], { type: 'application/pdf' })

// DOM download plumbing stubs. jsdom does not implement URL.createObjectURL /
// revokeObjectURL, so stub them; also spy on the temporary anchor's click so
// the test does not try to navigate.
let createObjectURL
let revokeObjectURL
let anchorClickSpy

beforeEach(() => {
  vi.clearAllMocks()
  viewChart.mockResolvedValue({ data: numbersRepresentation })

  createObjectURL = vi.fn(() => 'blob:fake-object-url')
  revokeObjectURL = vi.fn()
  vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL })

  // Spy on the click of the generated anchor so clicking never actually
  // navigates in jsdom.
  anchorClickSpy = vi
    .spyOn(HTMLAnchorElement.prototype, 'click')
    .mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllGlobals()
  anchorClickSpy.mockRestore()
})

// Wait for the viewer to finish loading so the Download PDF button is enabled.
const getEnabledDownloadButton = async () => {
  const btn = await screen.findByRole('button', { name: /download pdf/i })
  await waitFor(() => expect(btn).toBeEnabled())
  return btn
}

describe('ChartViewerPage — Download PDF (#13)', () => {
  it('calls downloadChartPdf with the default Numbers key when clicked (R13.1, R13.2)', async () => {
    const user = userEvent.setup()
    downloadChartPdf.mockResolvedValue({ data: pdfBlob })

    renderPage()
    const btn = await getEnabledDownloadButton()

    await user.click(btn)

    await waitFor(() =>
      expect(downloadChartPdf).toHaveBeenCalledWith('song-1', { key: 'Numbers' })
    )
  })

  it('calls downloadChartPdf with the selected key after a key change (R13.2)', async () => {
    const user = userEvent.setup()
    downloadChartPdf.mockResolvedValue({ data: pdfBlob })

    renderPage()
    await getEnabledDownloadButton()

    // Change the Key selection; the next viewChart resolves so the chart stays
    // rendered and the button stays enabled.
    viewChart.mockResolvedValueOnce({ data: { ...numbersRepresentation, keyLabel: 'G' } })
    await user.selectOptions(screen.getByLabelText('Key'), 'G')
    await waitFor(() => expect(viewChart).toHaveBeenCalledWith('song-1', { key: 'G' }))

    const btn = await getEnabledDownloadButton()
    await user.click(btn)

    await waitFor(() =>
      expect(downloadChartPdf).toHaveBeenCalledWith('song-1', { key: 'G' })
    )
  })

  it('turns the PDF blob into an object URL and revokes it on success (R13.1)', async () => {
    const user = userEvent.setup()
    downloadChartPdf.mockResolvedValue({ data: pdfBlob })

    renderPage()
    const btn = await getEnabledDownloadButton()

    await user.click(btn)

    // The Blob is turned into an object URL and a download is triggered.
    await waitFor(() => expect(createObjectURL).toHaveBeenCalledTimes(1))
    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob))
    expect(anchorClickSpy).toHaveBeenCalled()

    // And the object URL is revoked afterwards to avoid a leak.
    await waitFor(() =>
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake-object-url')
    )
  })

  it('shows a loading state ("Preparing…", disabled) while the request is in flight (R13.3)', async () => {
    const user = userEvent.setup()
    // Keep the download promise pending so we can observe the loading state.
    let resolveDownload
    downloadChartPdf.mockReturnValue(
      new Promise((resolve) => {
        resolveDownload = resolve
      })
    )

    renderPage()
    const btn = await getEnabledDownloadButton()

    await user.click(btn)

    // While in flight: button disabled and shows the preparing indicator.
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /preparing/i })).toBeDisabled()
    )

    // Resolve and confirm it returns to the enabled "Download PDF" state.
    resolveDownload({ data: pdfBlob })
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /download pdf/i })).toBeEnabled()
    )
  })

  it('surfaces a role="alert" error when downloadChartPdf rejects (R13.3)', async () => {
    const user = userEvent.setup()
    downloadChartPdf.mockRejectedValueOnce({
      response: { data: { error: { message: 'PDF generation failed' } } },
    })

    renderPage()
    const btn = await getEnabledDownloadButton()

    await user.click(btn)

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/PDF generation failed/i)

    // The button recovers to its enabled state after the failure.
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /download pdf/i })).toBeEnabled()
    )
  })

  it('disables the Download PDF button when there is no chart (empty state)', async () => {
    viewChart.mockRejectedValueOnce({
      response: { status: 404, data: { error: { code: 'CHART_NOT_FOUND' } } },
    })

    renderPage()

    // Empty state shown; the download button is present but disabled.
    expect(await screen.findByText(/no chart yet/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /download pdf/i })).toBeDisabled()
    expect(downloadChartPdf).not.toHaveBeenCalled()
  })
})
