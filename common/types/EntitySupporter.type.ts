export { type Tag } from '@d/database/schemas/tags.schema'
export { type EntityUrl } from '@d/database/schemas/urls.schema'
export { type TimeEntry } from '@d/database/schemas/time_entries.schema'

export interface EntitySupporter {
  id: string
  description?: string
  created_at: number // timestamp
  updated_at: number // timestamp
}
