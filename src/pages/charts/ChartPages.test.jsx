import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

import ChartPages from './ChartPages'

// Build a minimal single-page representation from an array of RenderLines.
function rep(lines) {
  return {
    title: 'T',
    artist: 'A',
    keyLabel: 'Numbers',
    formatting: { size: 11, columns: 1, chordColor: 'blue' },
    pages: [{ columns: [{ lines }] }],
  }
}

const chordSeg = (chord) => ({ chord, root: chord, quality: '', bass: null, lyric: ' ' })

describe('ChartPages — chord-only lines + repeat badge', () => {
  it('renders the verbatim repeat badge inline for a chord-only line', () => {
    const line = {
      segments: [chordSeg('1'), chordSeg('4'), chordSeg('5')],
      directive: null,
      transposeShift: null,
      chordOnly: true,
      repeat: 'x4',
    }
    render(<ChartPages representation={rep([line])} />)

    // The chords render...
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
    // ...and the badge renders verbatim on the same line.
    expect(screen.getByText('x4')).toBeInTheDocument()
  })

  it('renders no badge when a chord-only line has none', () => {
    const line = {
      segments: [chordSeg('1'), chordSeg('4')],
      directive: null,
      transposeShift: null,
      chordOnly: true,
      repeat: null,
    }
    const { container } = render(<ChartPages representation={rep([line])} />)
    expect(screen.getByText('1')).toBeInTheDocument()
    // No stray 'x' badge text.
    expect(container.textContent).not.toMatch(/x\d/)
  })

  it('keeps a verbatim multi-word badge (e.g. "x2 w/ band")', () => {
    const line = {
      segments: [chordSeg('1')],
      directive: null,
      transposeShift: null,
      chordOnly: true,
      repeat: 'x2 w/ band',
    }
    render(<ChartPages representation={rep([line])} />)
    expect(screen.getByText('x2 w/ band')).toBeInTheDocument()
  })

  it('a normal (lyric) line still renders its lyrics and ignores chordOnly rendering', () => {
    const line = {
      segments: [
        { chord: '1', root: '1', quality: '', bass: null, lyric: 'Some' },
        { chord: '4', root: '4', quality: '', bass: null, lyric: 'thing' },
      ],
      directive: null,
      transposeShift: null,
      // not chordOnly
    }
    render(<ChartPages representation={rep([line])} />)
    expect(screen.getByText('Some')).toBeInTheDocument()
    expect(screen.getByText('thing')).toBeInTheDocument()
  })
})
