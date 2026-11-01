import { Url, Tag, TimeEntry } from '@d/database/schemas'

// Tags/URLs sent alongside an entity; the server creates missing ones and links them
export type TagInput = Tag['Write']
export type UrlInput = Url['Write']
export type TimeEntryInput = TimeEntry['Write']
// Resources are linked by id; they are never created alongside an owner
export type ResourceRef = { id: string }
// A task or collection a resource is linked to, sent with the resource
export type ResourceLinkInput = {
  kind: 'tasks' | 'projects' | 'areas' | 'goals'
  id: string
}

export type SupportersInput = {
  tags?: TagInput[]
  urls?: UrlInput[]
  time_entries?: TimeEntryInput[]
  resources?: ResourceRef[]
}

export type WithSupporters<T> = T & SupportersInput
