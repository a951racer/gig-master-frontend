import { describe, it, expect } from 'vitest'
import { userLabel } from './users'

describe('userLabel', () => {
  it('renders "Last, First" when both names are present', () => {
    expect(userLabel({ firstName: 'Ann', lastName: 'Smith', email: 'a@b.com' })).toBe('Smith, Ann')
  })

  it('renders just the last name when only lastName is present', () => {
    expect(userLabel({ lastName: 'Smith', email: 'a@b.com' })).toBe('Smith')
  })

  it('renders just the first name when only firstName is present', () => {
    expect(userLabel({ firstName: 'Ann', email: 'a@b.com' })).toBe('Ann')
  })

  it('falls back to email when no names are present', () => {
    expect(userLabel({ email: 'a@b.com' })).toBe('a@b.com')
  })

  it('treats whitespace-only names as absent and falls back to email', () => {
    expect(userLabel({ firstName: '  ', lastName: '  ', email: 'a@b.com' })).toBe('a@b.com')
  })

  it('returns an empty string for a null/undefined user', () => {
    expect(userLabel(null)).toBe('')
    expect(userLabel(undefined)).toBe('')
  })
})
