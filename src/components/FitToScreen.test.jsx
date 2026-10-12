import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

import FitToScreen from './FitToScreen'
import { PAGE_WIDTH, PAGE_HEIGHT } from '../pages/charts/ChartPages'

// In jsdom, clientWidth/clientHeight report 0, so the measure effect never
// overrides the initial scale of 1 and no pixel math is exercised. These tests
// only assert the component mounts, renders its children, and keeps the inner
// scale wrapper present — deliberately not asserting exact dimensions given
// jsdom's zero layout.
describe('FitToScreen', () => {
  it('renders its children without throwing', () => {
    render(
      <FitToScreen>
        <div data-testid="child">x</div>
      </FitToScreen>
    )
    expect(screen.getByTestId('child')).toBeInTheDocument()
    expect(screen.getByTestId('child')).toHaveTextContent('x')
  })

  it('keeps a transform:scale wrapper at the initial scale of 1', () => {
    const { container } = render(
      <FitToScreen>
        <div data-testid="child">x</div>
      </FitToScreen>
    )

    // The inner wrapper that applies the scale transform should be present and,
    // with jsdom's zero container dimensions, remain at the initial scale 1.
    const scaleWrapper = container.querySelector('[style*="scale(1)"]')
    expect(scaleWrapper).not.toBeNull()
    expect(scaleWrapper).toHaveStyle({
      width: `${PAGE_WIDTH}px`,
      height: `${PAGE_HEIGHT}px`,
    })
    // The child lives inside the scale wrapper.
    expect(scaleWrapper).toContainElement(screen.getByTestId('child'))
  })
})
