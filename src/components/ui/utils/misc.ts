// `in_progress` -> `In progress`
export const toLabel = (value: string) => {
  const spaced = value.replace(/_/g, ' ')
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

/** Truncates a string when it exceeds a maximum length, adding an ellipsis to indicate omitted content. */
export const trimString = (str: string, maxLength: number) => {
  return str.length > maxLength ? str.slice(0, maxLength) + '...' : str
}
