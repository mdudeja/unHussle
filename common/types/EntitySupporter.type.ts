export { type EntityTag } from '@d/database/schemas/entity_tags.schema'
export { type EntityUrl } from '@d/database/schemas/entity_urls.schema'
export { type TimeEntry } from '@d/database/schemas/time_entries.schema'

export interface EntitySupporter {
  id: string
  description?: string
  created_at: number // timestamp
  updated_at: number // timestamp
}
