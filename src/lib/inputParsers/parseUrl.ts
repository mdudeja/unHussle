import { Url } from '@d/database/schemas'

type UrlParseResult = {
  urls: Url['Write'][]
  textMinusUrls: string
}

// Matches a URL-like token anywhere in the text: either an explicit scheme
// (http/https/file) or a `www.` prefix. A bare word is intentionally not
// treated as a URL.
const urlRegex = /(?:(?:https?|file):\/\/|www\.)\S+/gi
const trailingPunctuationRegex = /[.,;:!?)\]}>'"]+$/

// The server only accepts absolute URIs, so `www.` input gets a scheme.
export const normalizeUrl = (url: string): string =>
  /^www\./i.test(url) ? `https://${url}` : url

/** Extracts URLs from a text input and separates them from the remaining non-URL text. */
export const parseUrl = (inputText: string): UrlParseResult => {
  const matches = (inputText.match(urlRegex) ?? []).map((raw) =>
    raw.replace(trailingPunctuationRegex, ''),
  )
  const urls = matches.map((raw) => ({ url: normalizeUrl(raw) }))

  let textMinusUrls = inputText
  matches.forEach((raw) => {
    textMinusUrls = textMinusUrls.split(raw).join('')
  })

  return { urls, textMinusUrls }
}
