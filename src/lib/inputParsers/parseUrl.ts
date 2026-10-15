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

export const parseUrl = (inputText: string): UrlParseResult => {
  const matches = inputText.match(urlRegex) ?? []
  const urls = matches.map((raw) => ({
    url: raw.replace(trailingPunctuationRegex, ''),
  }))

  let textMinusUrls = inputText
  urls.forEach(({ url }) => {
    textMinusUrls = textMinusUrls.split(url).join('')
  })

  return { urls, textMinusUrls }
}
