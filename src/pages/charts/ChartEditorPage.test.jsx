import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

// Mock the charts API layer so no network happens. The editor calls `getChart`
// on mount, `previewChart` on a debounced change of body/keys, and `saveChart`
// on Save.
vi.mock('../../api/charts', () => ({
  getChart: vi.fn(),
  previewChart: vi.fn(),
  saveChart: vi.fn(),
}))

// Band context: a band is selected (editing is band-scoped, R11.7).
const currentBand = { id: 'b1', name: 'The Band' }
vi.mock('../../auth/BandContext', () => ({
  useBand: () => ({ currentBand, hasNoBand: false }),
}))

// Supply the route param `id` (songId) and a navigate stub, matching the
// project convention (see ChartViewerPage.test.jsx / admin BandDetailPage).
const navigateMock = vi.fn()
vi.mock('react-router-dom', async (orig) => {
  const actual = await orig()
  return {
    ...actual,
    useParams: () => ({ id: 'song-1' }),
    useNavigate: () => navigateMock,
  }
})

import ChartEditorPage from './ChartEditorPage'
import { getChart, previewChart, saveChart } from '../../api/charts'

const renderPage = () => render(<MemoryRouter><ChartEditorPage /></MemoryRouter>)

// A stored chart returned from getChart. Title/artist are Song properties the
// server includes on the chart payload — read-only context, never saved back.
const storedChart = {
  body: '[1]Amazing [4]grace',
  title: 'Amazing Grace',
  artist: 'John Newton',
  formatting: { font: 'monospace', size: 11, chordColor: 'blue', columns: 1 },
}

// A minimal Render_Representation returned from previewChart.
const previewRepresentation = {
  title: 'Amazing Grace',
  artist: 'John Newton',
  keyLabel: 'Numbers',
  sections: [],
}

// The live preview is debounced 400ms. Rather than fight Testing Library's
// internal timers with fake timers, we let the debounce elapse under real
// timers and drive assertions through `waitFor` (default 1000ms window, which
// comfortably clears the 400ms debounce). This mirrors the project convention
// of waitFor-driven async assertions (see ChartViewerPage.test.jsx).
const PREVIEW_TIMEOUT = 2000

beforeEach(() => {
  vi.clearAllMocks()
  getChart.mockResolvedValue({ data: storedChart })
  previewChart.mockResolvedValue({ data: previewRepresentation })
  saveChart.mockResolvedValue({ data: { ...storedChart } })
})

// Wait for the on-mount getChart load to settle so the editor is interactive
// (textarea enabled, body populated).
const waitForLoaded = async () => {
  await waitFor(() => expect(getChart).toHaveBeenCalledWith('song-1'))
  await waitFor(() =>
    expect(screen.getByLabelText('Entered Key')).not.toBeDisabled()
  )
  await waitFor(() =>
    expect(screen.getByDisplayValue(storedChart.body)).toBeInTheDocument()
  )
}

describe('ChartEditorPage (#9.3)', () => {
  describe('Entered/Displayed key selection drives preview args (R11.2, R11.3)', () => {
    it('changing Entered Key triggers a debounced preview with the new enteredKey', async () => {
      const user = userEvent.setup()
      renderPage()
      await waitForLoaded()
      previewChart.mockClear()

      await user.selectOptions(screen.getByLabelText('Entered Key'), 'G')

      await waitFor(
        () =>
          expect(previewChart).toHaveBeenCalledWith(
            'song-1',
            expect.objectContaining({ enteredKey: 'G', body: storedChart.body }),
          ),
        { timeout: PREVIEW_TIMEOUT },
      )
    })

    it('changing Displayed Key triggers a debounced preview with the new displayedKey', async () => {
      const user = userEvent.setup()
      renderPage()
      await waitForLoaded()
      previewChart.mockClear()

      await user.selectOptions(screen.getByLabelText('Displayed Key'), 'D')

      await waitFor(
        () =>
          expect(previewChart).toHaveBeenCalledWith(
            'song-1',
            expect.objectContaining({ displayedKey: 'D', body: storedChart.body }),
          ),
        { timeout: PREVIEW_TIMEOUT },
      )
    })

    it('does not call previewChart for an empty body', async () => {
      getChart.mockResolvedValueOnce({ data: { ...storedChart, body: '' } })
      renderPage()

      await waitFor(() => expect(getChart).toHaveBeenCalledWith('song-1'))
      await waitFor(() =>
        expect(screen.getByLabelText('Entered Key')).not.toBeDisabled()
      )
      previewChart.mockClear()

      // Wait past the debounce window; an empty body must not hit the server.
      await new Promise((r) => setTimeout(r, PREVIEW_TIMEOUT))
      expect(previewChart).not.toHaveBeenCalled()
    })

    it('both key selectors default to "Numbers"', async () => {
      renderPage()
      await waitForLoaded()

      expect(screen.getByLabelText('Entered Key')).toHaveValue('Numbers')
      expect(screen.getByLabelText('Displayed Key')).toHaveValue('Numbers')
    })
  })

  describe('Options menu inserts modify the textarea body (R11.4, R11.5)', () => {
    const openOptions = async (user) => {
      await user.click(screen.getByRole('button', { name: /options/i }))
      return screen.getByRole('menu')
    }

    it('Page Break inserts PAGE_BREAK into the textarea', async () => {
      const user = userEvent.setup()
      renderPage()
      await waitForLoaded()

      const menu = await openOptions(user)
      await user.click(within(menu).getByRole('menuitem', { name: /page break/i }))

      await waitFor(() =>
        expect(screen.getByDisplayValue(/PAGE_BREAK/)).toBeInTheDocument()
      )
    })

    it('Column Break inserts COLUMN_BREAK into the textarea', async () => {
      const user = userEvent.setup()
      renderPage()
      await waitForLoaded()

      const menu = await openOptions(user)
      await user.click(within(menu).getByRole('menuitem', { name: /column break/i }))

      await waitFor(() =>
        expect(screen.getByDisplayValue(/COLUMN_BREAK/)).toBeInTheDocument()
      )
    })

    it('a chord symbol button inserts its glyph into the textarea', async () => {
      const user = userEvent.setup()
      renderPage()
      await waitForLoaded()

      const menu = await openOptions(user)
      await user.click(within(menu).getByRole('menuitem', { name: 'Insert °' }))

      await waitFor(() =>
        expect(screen.getByDisplayValue(/°/)).toBeInTheDocument()
      )
    })

    it('Revert All Changes resets the textarea to the last-loaded body', async () => {
      const user = userEvent.setup()
      renderPage()
      await waitForLoaded()

      // Mutate the body via an insert, then revert.
      let menu = await openOptions(user)
      await user.click(within(menu).getByRole('menuitem', { name: /page break/i }))
      await waitFor(() => expect(screen.getByDisplayValue(/PAGE_BREAK/)).toBeInTheDocument())

      menu = await openOptions(user)
      await user.click(within(menu).getByRole('menuitem', { name: /revert all changes/i }))

      await waitFor(() =>
        expect(screen.getByDisplayValue(storedChart.body)).toBeInTheDocument()
      )
      expect(screen.queryByDisplayValue(/PAGE_BREAK/)).not.toBeInTheDocument()
    })
  })

  describe('Formatting modal values persist on save (R1.4, R11.4)', () => {
    it('opening Formatting shows a dialog bound to the loaded formatting', async () => {
      const user = userEvent.setup()
      renderPage()
      await waitForLoaded()

      await user.click(screen.getByRole('button', { name: /formatting/i }))
      const dialog = await screen.findByRole('dialog')

      expect(within(dialog).getByLabelText('Font')).toHaveValue('monospace')
      expect(within(dialog).getByLabelText('Chord Color')).toHaveValue('blue')
      expect(within(dialog).getByLabelText('Columns')).toHaveValue('1')
    })

    it('changed Columns/Chord Color are included in the saveChart payload', async () => {
      const user = userEvent.setup()
      renderPage()
      await waitForLoaded()

      await user.click(screen.getByRole('button', { name: /formatting/i }))
      const dialog = await screen.findByRole('dialog')

      await user.selectOptions(within(dialog).getByLabelText('Columns'), '2')
      await user.selectOptions(within(dialog).getByLabelText('Chord Color'), 'red')
      await user.click(within(dialog).getByRole('button', { name: /done/i }))

      await user.click(screen.getByRole('button', { name: /^save$/i }))

      await waitFor(() =>
        expect(saveChart).toHaveBeenCalledWith(
          'song-1',
          expect.objectContaining({
            formatting: expect.objectContaining({ columns: 2, chordColor: 'red' }),
          }),
        ),
      )
    })
  })

  describe('Song title/artist are read-only (not chart-overridable)', () => {
    it('shows the song title and artist as read-only text, not editable inputs', async () => {
      renderPage()
      await waitForLoaded()

      // Title/artist appear as static context...
      expect(screen.getByText('Amazing Grace')).toBeInTheDocument()
      expect(screen.getByText('John Newton')).toBeInTheDocument()

      // ...and there are no editable Title / Artist Label inputs.
      expect(screen.queryByLabelText('Title')).not.toBeInTheDocument()
      expect(screen.queryByLabelText('Artist Label')).not.toBeInTheDocument()
    })
  })

  describe('Save sends the correct payload (R11.1)', () => {
    it('Save calls saveChart with only enteredKey, body and formatting (no title/artist)', async () => {
      const user = userEvent.setup()
      renderPage()
      await waitForLoaded()

      await user.click(screen.getByRole('button', { name: /^save$/i }))

      await waitFor(() =>
        expect(saveChart).toHaveBeenCalledWith('song-1', {
          enteredKey: 'Numbers',
          body: storedChart.body,
          formatting: storedChart.formatting,
        }),
      )

      // Title/artist must NOT be part of the payload.
      const payload = saveChart.mock.calls[0][1]
      expect(payload).not.toHaveProperty('title')
      expect(payload).not.toHaveProperty('artistLabel')
      expect(payload).not.toHaveProperty('artist')
    })

    it('Save includes the selected Entered Key in the payload', async () => {
      const user = userEvent.setup()
      renderPage()
      await waitForLoaded()

      await user.selectOptions(screen.getByLabelText('Entered Key'), 'A')
      await user.click(screen.getByRole('button', { name: /^save$/i }))

      await waitFor(() =>
        expect(saveChart).toHaveBeenCalledWith(
          'song-1',
          expect.objectContaining({ enteredKey: 'A', body: storedChart.body }),
        ),
      )
    })
  })
})
