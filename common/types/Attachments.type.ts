import { Url, Tag } from '@d/database/schemas'

// Tags/URLs sent alongside an entity; the server creates missing ones and links them
export type TagInput = Tag['Write']
export type UrlInput = Url['Write']
export type WithAttachments<T> = T & { tags?: TagInput[]; urls?: UrlInput[] }
