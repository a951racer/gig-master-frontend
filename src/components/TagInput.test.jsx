import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import TagInput from './TagInput'

// Thin controlled wrapper so we can observe the array TagInput emits.
function Harness({ initial = [] }) {
  const [tags, setTags] = useState(initial)
  return (
    <>
      <TagInput value={tags} onChange={setTags} />
      <output data-testid="val">{JSON.stringify(tags)}</output>
    </>
  )
}

const val = () => JSON.parse(screen.getByTestId('val').textContent)

describe('TagInput (#99)', () => {
  it('adds a tag on Enter', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.type(screen.getByRole('textbox'), 'upbeat{Enter}')
    expect(val()).toEqual(['upbeat'])
    expect(screen.getByText('upbeat')).toBeInTheDocument()
  })

  it('adds a tag on comma and trims whitespace', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.type(screen.getByRole('textbox'), '  mellow  ,')
    expect(val()).toEqual(['mellow'])
  })

  it('ignores blank and case-insensitive duplicate entries', async () => {
    const user = userEvent.setup()
    render(<Harness initial={['Rock']} />)
    const box = screen.getByRole('textbox')
    await user.type(box, '   {Enter}')     // blank
    await user.type(box, 'rock{Enter}')    // dup (different case)
    expect(val()).toEqual(['Rock'])
  })

  it('removes a chip via its × button', async () => {
    const user = userEvent.setup()
    render(<Harness initial={['a', 'b']} />)
    await user.click(screen.getByRole('button', { name: 'Remove a' }))
    expect(val()).toEqual(['b'])
  })

  it('Backspace on empty input removes the last chip', async () => {
    const user = userEvent.setup()
    render(<Harness initial={['a', 'b']} />)
    screen.getByRole('textbox').focus()
    await user.keyboard('{Backspace}')
    expect(val()).toEqual(['a'])
  })
})
