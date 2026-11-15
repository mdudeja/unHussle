/**
 * What a tracker follows. The unit labels progress for items that don't
 * count units themselves, such as "4 / 12 lectures".
 */
export const TRACKER_TYPES = [
  { id: 'book', name: 'Books', unit: 'pages' },
  { id: 'course', name: 'Courses', unit: 'modules' },
  { id: 'lectures', name: 'Lecture series', unit: 'lectures' },
] as const

export type TrackerTypeId = (typeof TRACKER_TYPES)[number]['id']

export const trackerType = (id: TrackerTypeId) =>
  TRACKER_TYPES.find((type) => type.id === id) ?? TRACKER_TYPES[0]
