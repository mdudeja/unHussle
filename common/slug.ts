// Names Windows refuses as file names, with or without an extension.
const reservedNames = new Set([
  'con',
  'prn',
  'aux',
  'nul',
  ...Array.from({ length: 9 }, (_, i) => `com${i + 1}`),
  ...Array.from({ length: 9 }, (_, i) => `lpt${i + 1}`),
])

const maxLength = 80

/** File-name-safe slug of a title: "Q3 Plan" → "q3-plan". */
export function slugify(title: string): string {
  const slug = title
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength)
    .replace(/-+$/, '')

  if (!slug) return 'untitled'
  return reservedNames.has(slug) ? `${slug}-file` : slug
}
