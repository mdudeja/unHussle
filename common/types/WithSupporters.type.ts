import { Url, Tag, TimeEntry } from '@d/database/schemas'

// Tags/URLs sent alongside an entity; the server creates missing ones and links them
export type TagInput = Tag['Write']
export type UrlInput = Url['Write']
export type TimeEntryInput = TimeEntry['Write']

export type SupportersInput = {
  tags?: TagInput[]
  urls?: UrlInput[]
  time_entries?: TimeEntryInput[]
}

export type WithSupporters<T> = T & SupportersInput
