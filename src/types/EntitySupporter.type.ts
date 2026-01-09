import { Entity } from '@/types/Entity.type'

export interface EntitySupporter {
  id: string
  description?: string
  created_at: number // timestamp
  updated_at: number // timestamp
}

export interface Tag extends EntitySupporter {
  title: string
  color?: string
}

export interface EntityUrl extends EntitySupporter {
  title?: string
  url: string
  protocol: string
  domain: string
  path: string
  query: string
  fragment: string
}

export interface EntityTag {
  entity_id: Entity['id']
  tag_id: Tag['id']
}
