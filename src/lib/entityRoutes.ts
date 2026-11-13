export const entityRoutes = {
  projects: '/projects',
  areas: '/areas',
  goals: '/goals',
  tasks: '/tasks',
  urls: '/urls',
  tags: '/tags',
  resources: '/resources',
} as const

export type EntityRouteKey = keyof typeof entityRoutes

// Query params understood by entity lists. Filters use their id as their
// param name (e.g. `?status=planned`).
export const entitySearchParams = {
  search: 'q',
  sort: 'sort',
  dir: 'dir',
  page: 'page',
  pageSize: 'psize',
  // The open tab on a detail page.
  tab: 'tab',
} as const

// Every item has its own page; for a resource that page is its editor.
export const getEntityItemRoute = (entity: EntityRouteKey, id: string) =>
  `${entityRoutes[entity]}/${encodeURIComponent(id)}`

/** Generates the route path for a specific resource. */
export const getResourceRoute = (id: string) =>
  getEntityItemRoute('resources', id)
