import { describe, test, expect } from 'bun:test'
import { parseUrl } from '@/lib/inputParsers/parseUrl'

describe('parseUrl', () => {
  test('extracts a single explicit URL at the end of the text', () => {
    const result = parseUrl('check this out http://foo.com/bar')
    expect(result.urls).toEqual([{ url: 'http://foo.com/bar' }])
    expect(result.textMinusUrls).toBe('check this out ')
  })

  test('removes the extracted URL from the remaining text', () => {
    const result = parseUrl('Buy milk https://example.com')
    expect(result.urls).toEqual([{ url: 'https://example.com' }])
    expect(result.textMinusUrls).toBe('Buy milk ')
  })

  test('extracts a www. URL and prefixes https://', () => {
    const result = parseUrl('go to www.example.com')
    expect(result.urls).toEqual([{ url: 'https://www.example.com' }])
    expect(result.textMinusUrls).toBe('go to ')
  })

  test('keeps an explicit scheme on www. hosts', () => {
    expect(parseUrl('see http://www.example.com').urls).toEqual([
      { url: 'http://www.example.com' },
    ])
  })

  test('extracts a file:// URL', () => {
    expect(parseUrl('open file:///tmp/a.txt').urls).toEqual([
      { url: 'file:///tmp/a.txt' },
    ])
  })

  test('extracts multiple URLs from the text', () => {
    const result = parseUrl('a https://a.com b https://b.com')
    expect(result.urls).toEqual([
      { url: 'https://a.com' },
      { url: 'https://b.com' },
    ])
  })

  test('extracts a URL that is followed by other words', () => {
    const result = parseUrl('visit https://a.com today')
    expect(result.urls).toEqual([{ url: 'https://a.com' }])
  })

  test('does not treat a plain trailing word as a URL', () => {
    const result = parseUrl('Buy milk')
    expect(result.urls).toEqual([])
    expect(result.textMinusUrls).toBe('Buy milk')
  })

  test('returns the text unchanged when there is no URL', () => {
    const result = parseUrl('do the thing')
    expect(result.urls).toEqual([])
    expect(result.textMinusUrls).toBe('do the thing')
  })
})
