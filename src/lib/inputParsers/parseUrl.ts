import { Url } from '@d/database/schemas'

type UrlParseResult = {
  urls: Url['Write'][]
  urlCleanText: string
}

export const parseUrl = (
  inputText: string,
  cleanText: string,
): UrlParseResult => {
  const result: UrlParseResult = { urls: [], urlCleanText: cleanText }
  const urlRegex = /(https?:\/\/[^\s]+|file:\/\/[^\s]+)/gi
  const urls = inputText.match(urlRegex)
  result.urls = urls ? urls.map((url) => ({ url })) : []

  result.urls.forEach((urlObj) => {
    result.urlCleanText = result.urlCleanText.replace(urlObj.url, '')
  })

  return result
}
