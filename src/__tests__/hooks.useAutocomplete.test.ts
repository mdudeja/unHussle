import { describe, test, expect } from 'bun:test'
import { findActiveAutocompleteToken } from '@/lib/hooks/useAutocomplete'

describe('findActiveAutocompleteToken', () => {
  test('returns null when the trigger character is absent', () => {
    expect(findActiveAutocompleteToken('Buy milk', '#')).toBeNull()
  })

  test('detects a token at the start of the value', () => {
    expect(findActiveAutocompleteToken('#gro', '#')).toEqual({
      start: 0,
      end: 4,
      query: 'gro',
    })
  })

  test('detects a token after whitespace', () => {
    expect(findActiveAutocompleteToken('Buy #gro', '#')).toEqual({
      start: 4,
      end: 8,
      query: 'gro',
    })
  })

  test('exposes an empty query when only the trigger is typed', () => {
    expect(findActiveAutocompleteToken('Buy #', '#')).toEqual({
      start: 4,
      end: 5,
      query: '',
    })
  })

  test('returns null when the token is followed by whitespace', () => {
    expect(findActiveAutocompleteToken('Buy #gro milk', '#')).toBeNull()
  })

  test('returns null when the trigger is glued to a word', () => {
    expect(findActiveAutocompleteToken('foo#bar', '#')).toBeNull()
  })

  test('uses the last trigger when several are present', () => {
    expect(findActiveAutocompleteToken('#one #two', '#')).toEqual({
      start: 5,
      end: 9,
      query: 'two',
    })
  })
})
