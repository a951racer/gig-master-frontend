import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Mock the band context; useBand is stubbed per-test via mockReturnValue.
vi.mock('../../auth/BandContext', () => ({ useBand: vi.fn() }))

import BandSwitcher from './BandSwitcher'
import { useBand } from '../../auth/BandContext'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('BandSwitcher — hidden when nothing to switch (Req 2.3)', () => {
  it('renders nothing when the user belongs to no bands', () => {
    useBand.mockReturnValue({ bands: [], currentBand: null, setCurrentBand: vi.fn() })

    const { container } = render(<BandSwitcher />)

    expect(container.firstChild).toBeNull()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Current band')).not.toBeInTheDocument()
  })

  it('renders nothing when the user belongs to exactly one band', () => {
    useBand.mockReturnValue({
      bands: [{ id: 'b1', name: 'The Only Band' }],
      currentBand: { id: 'b1', name: 'The Only Band' },
      setCurrentBand: vi.fn(),
    })

    const { container } = render(<BandSwitcher />)

    expect(container.firstChild).toBeNull()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Current band')).not.toBeInTheDocument()
  })
})

describe('BandSwitcher — selector for multiple bands (Req 2.1)', () => {
  it('renders a select with an option per band and the current band selected', () => {
    useBand.mockReturnValue({
      bands: [
        { id: 'b1', name: 'The Night Owls' },
        { id: 'b2', name: 'Daytime Trio' },
      ],
      currentBand: { id: 'b2', name: 'Daytime Trio' },
      setCurrentBand: vi.fn(),
    })

    render(<BandSwitcher />)

    const select = screen.getByRole('combobox', { name: 'Current band' })
    expect(select).toBeInTheDocument()

    // One option per band, each listed by name.
    expect(screen.getByRole('option', { name: 'The Night Owls' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Daytime Trio' })).toBeInTheDocument()

    // The current band is the selected value.
    expect(select).toHaveValue('b2')
  })

  it('calls setCurrentBand with the chosen band id when the selection changes', async () => {
    const user = userEvent.setup()
    const setCurrentBand = vi.fn()
    useBand.mockReturnValue({
      bands: [
        { id: 'b1', name: 'The Night Owls' },
        { id: 'b2', name: 'Daytime Trio' },
      ],
      currentBand: { id: 'b1', name: 'The Night Owls' },
      setCurrentBand,
    })

    render(<BandSwitcher />)

    const select = screen.getByRole('combobox', { name: 'Current band' })
    await user.selectOptions(select, 'b2')

    expect(setCurrentBand).toHaveBeenCalledWith('b2')
  })
})
