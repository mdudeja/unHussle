export const entityRoutes = {
  projects: '/projects',
  areas: '/areas',
  goals: '/goals',
  tasks: '/tasks',
  urls: '/urls',
  tags: '/tags',
} as const

export type EntityRouteKey = keyof typeof entityRoutes

// Query params understood by entity list pages. Column filters use the
// column id as their param name (e.g. `?status=planned`).
export const entitySearchParams = {
  id: 'id',
  search: 'q',
  // Present when the selected item's related items are shown.
  related: 'related',
} as const

export const getEntityItemRoute = (entity: EntityRouteKey, id: string) =>
  `${entityRoutes[entity]}?${new URLSearchParams({ [entitySearchParams.id]: id })}`
