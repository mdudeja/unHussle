/**
 * Recursively converts ISO date strings to Date objects in an object
 * This handles JSON serialization where Date objects become strings
 */
export const convertDateStrings = (obj: any): any => {
  if (obj === null || obj === undefined) {
    return obj
  }

  if (typeof obj === 'string') {
    const isoDateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/
    if (isoDateRegex.test(obj)) {
      const date = new Date(obj)
      if (!isNaN(date.getTime())) {
        return date
      }
    }
    return obj
  }

  if (Array.isArray(obj)) {
    return obj.map(convertDateStrings)
  }

  if (typeof obj === 'object') {
    const converted: any = {}
    for (const key in obj) {
      converted[key] = convertDateStrings(obj[key])
    }
    return converted
  }

  return obj
}
