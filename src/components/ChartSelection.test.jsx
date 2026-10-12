import { describe, it, expect, vi } from 'vitest'
import { useState } from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import ChartSelection, { MODE_NUMBERS, MODE_CHORDS } from './ChartSelection'

// Two setlist rows: one with a played key, one without.
const songRows = [
  { songId: 's1', title: 'Alpha', playedKey: 'A' },
  { songId: 's2', title: 'Beta', playedKey: '' },
]

// A controlled wrapper so onSetAll/onSetOne actually mutate `modes`, exercising
// the same parent-owns-state contract GigChartsPage uses. Spies are forwarded
// so tests can assert the exact callback args.
function Harness({ initialModes = {}, onSetAll, onSetOne }) {
  const [modes, setModes] = useState(initialModes)
  return (
    <ChartSelection
      songRows={songRows}
      modes={modes}
      onSetAll={(mode) => {
        onSetAll?.(mode)
        setModes(Object.fromEntries(songRows.map((r) => [r.songId, mode])))
      }}
      onSetOne={(songId, mode) => {
        onSetOne?.(songId, mode)
        setModes((prev) => ({ ...prev, [songId]: mode }))
      }}
    />
  )
}

describe('ChartSelection', () => {
  it('renders each song title and shows [playedKey] only when present', () => {
    render(<Harness />)

    expect(screen.getByText('Alpha')).toBeInTheDocument()
    expect(screen.getByText('Beta')).toBeInTheDocument()

    // Row with a played key shows it in brackets.
    expect(screen.getByText('[A]')).toBeInTheDocument()
    // Row with an empty key shows no bracket at all.
    expect(screen.queryByText('[]')).not.toBeInTheDocument()
    expect(screen.queryByText(/\[\s*\]/)).not.toBeInTheDocument()
  })

  it('"All Chords" calls onSetAll("Chords") and "All Numbers" calls onSetAll("Numbers")', async () => {
    const user = userEvent.setup()
    const onSetAll = vi.fn()
    render(<Harness onSetAll={onSetAll} />)

    await user.click(screen.getByRole('button', { name: 'All Chords' }))
    expect(onSetAll).toHaveBeenCalledWith(MODE_CHORDS)

    await user.click(screen.getByRole('button', { name: 'All Numbers' }))
    expect(onSetAll).toHaveBeenCalledWith(MODE_NUMBERS)
  })

  it('clicking a per-song "Chords" button calls onSetOne with that songId', async () => {
    const user = userEvent.setup()
    const onSetOne = vi.fn()
    render(<Harness onSetOne={onSetOne} />)

    const g1 = screen.getByRole('group', { name: /mode for alpha/i })
    await user.click(within(g1).getByRole('button', { name: 'Chords' }))

    expect(onSetOne).toHaveBeenCalledWith('s1', MODE_CHORDS)
  })

  it('aria-pressed reflects the current mode (s1 seeded to Numbers)', () => {
    render(<Harness initialModes={{ s1: MODE_NUMBERS, s2: MODE_CHORDS }} />)

    const g1 = screen.getByRole('group', { name: /mode for alpha/i })
    expect(within(g1).getByRole('button', { name: 'Numbers' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(g1).getByRole('button', { name: 'Chords' })).toHaveAttribute('aria-pressed', 'false')

    const g2 = screen.getByRole('group', { name: /mode for beta/i })
    expect(within(g2).getByRole('button', { name: 'Chords' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(g2).getByRole('button', { name: 'Numbers' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('exposes each per-song control set via role="group" named for the song', () => {
    render(<Harness />)

    const g1 = screen.getByRole('group', { name: /mode for alpha/i })
    expect(within(g1).getByRole('button', { name: 'Numbers' })).toBeInTheDocument()
    expect(within(g1).getByRole('button', { name: 'Chords' })).toBeInTheDocument()
  })

  it('clicking per-song toggles updates aria-pressed through the controlled parent', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    const g1 = screen.getByRole('group', { name: /mode for alpha/i })
    // Default is Numbers pressed.
    expect(within(g1).getByRole('button', { name: 'Numbers' })).toHaveAttribute('aria-pressed', 'true')

    await user.click(within(g1).getByRole('button', { name: 'Chords' }))
    expect(within(g1).getByRole('button', { name: 'Chords' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(g1).getByRole('button', { name: 'Numbers' })).toHaveAttribute('aria-pressed', 'false')
  })
})
