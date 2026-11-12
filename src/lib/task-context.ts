import type { ContextItems } from '@c/types/Hydrated'

/** Resources and links in one group of a task's context; tags aren't counted. */
export const contextCountOf = ({ resources, urls }: ContextItems) =>
  resources.length + urls.length
