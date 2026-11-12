import { useState } from 'react'
import { useSearchParams } from 'react-router'
import type { ContainerDetail, ReadContainerKind } from '@c/types/readModels'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EntityList, type EntityListConfig } from '@/components/app/entity-list'
import type { EntityRow } from '@/components/app/entity-list-row'
import { useContainerDetail } from '@/lib/hooks/useRelatedItems'
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue'
import {
  type ListStateControl,
  useLocalListState,
} from '@/lib/hooks/use-list-state'
import { entitySearchParams } from '@/lib/entityRoutes'
import { parseTaskFlagFilter, TASK_FLAG_FILTER_ID } from '@/lib/task-flags'
import {
  applyListState,
  LIST_PAGE_SIZE,
  ListState,
  pageCountOf,
  searchRows,
} from '@/lib/list-view'
import {
  areasList,
  goalsList,
  projectsList,
  resourcesList,
  tagsList,
  tasksList,
  urlsList,
} from '@/pages/entity-list-configs'

const SEARCH_DEBOUNCE_MS = 300

type Relation = keyof ContainerDetail['directRelations']

const relationLists = {
  projects: projectsList,
  areas: areasList,
  goals: goalsList,
  resources: resourcesList,
  urls: urlsList,
  tags: tagsList,
} as Record<Relation, EntityListConfig<EntityRow & { title?: string | null }>>

/** Tasks in the container, including those of its goals and projects. */
function TasksTab({ kind, id }: { kind: ReadContainerKind; id: string }) {
  const control = useLocalListState(tasksList.initialSort)
  const { q, filters, sort, desc } = control.state
  const searchTerm = useDebouncedValue(q.trim(), SEARCH_DEBOUNCE_MS)

  // Pages are fetched by cursor; a new search, filter or sort starts over.
  const criteriaKey = JSON.stringify({ searchTerm, filters, sort, desc })
  const [paging, setPaging] = useState({
    criteriaKey,
    cursors: [undefined] as (string | undefined)[],
  })

  const cursors =
    paging.criteriaKey === criteriaKey ? paging.cursors : [undefined]

  // The server takes one param per flag (`is_quick=false`).
  const { [TASK_FLAG_FILTER_ID]: flagFilter, ...fieldFilters } = filters
  const flag = flagFilter ? parseTaskFlagFilter(flagFilter) : undefined
  const query = useContainerDetail(kind, id, {
    ...fieldFilters,
    ...(flag && { [flag.id]: String(flag.isSet) }),
    q: searchTerm,
    sort,
    direction: desc ? 'desc' : 'asc',
    cursor: cursors[cursors.length - 1],
    limit: LIST_PAGE_SIZE,
  })
  const page = query.data?.tasks
  const total = page?.total ?? 0

  const pagedControl: ListStateControl = {
    state: { ...control.state, page: cursors.length },
    update: (patch: Partial<ListState>) => {
      const isPageChange =
        patch.page !== undefined && Object.keys(patch).length === 1
      if (!isPageChange) {
        control.update(patch)
        return
      }
      const nextPage = patch.page ?? 1
      setPaging({
        criteriaKey,
        cursors:
          nextPage > cursors.length
            ? [...cursors, page?.nextCursor ?? undefined]
            : cursors.slice(0, nextPage),
      })
    },
  }

  return (
    <EntityList
      config={tasksList}
      control={pagedControl}
      items={page?.items ?? []}
      total={total}
      page={cursors.length}
      pageCount={pageCountOf(total)}
      isLoading={query.isLoading}
      isSearching={q.trim() !== searchTerm}
      error={query.error}
      onRetry={query.retry}
    />
  )
}

function RelationTab<T extends EntityRow & { title?: string | null }>({
  config,
  rows,
  query,
}: {
  config: EntityListConfig<T>
  rows: T[]
  query: { isLoading: boolean; error: unknown; retry: () => void }
}) {
  const control = useLocalListState(config.initialSort)
  const view = applyListState(
    searchRows(rows, control.state.q),
    control.state,
    config.filters,
    config.sorts,
  )
  return (
    <EntityList
      config={config}
      control={control}
      items={view.rows}
      total={view.total}
      page={view.page}
      pageCount={view.pageCount}
      isLoading={query.isLoading}
      error={query.error}
      onRetry={query.retry}
    />
  )
}

/**
 * Tabs for what a container holds: its tasks, then the `relations` it is
 * directly linked to. The open tab is kept in the URL.
 */
export function ContainerTabs({
  kind,
  id,
  relations,
}: {
  kind: ReadContainerKind
  id: string
  relations: Relation[]
}) {
  const [searchParams, setSearchParams] = useSearchParams()
  // Unfiltered, for the tab counts and the related items.
  const overview = useContainerDetail(kind, id, { limit: 1 })
  const tabIds = ['tasks', ...relations]
  const requested = searchParams.get(entitySearchParams.tab)
  const tab = requested && tabIds.includes(requested) ? requested : 'tasks'
  const count = (relation: string) => {
    const data = overview.data
    if (!data) {
      return undefined
    }
    return relation === 'tasks'
      ? data.tasks.total
      : data.directRelations[relation as Relation].length
  }
  const label = (relation: string, title: string) => {
    const value = count(relation)
    return value === undefined ? title : `${title} (${value})`
  }

  return (
    <Tabs
      value={tab}
      onValueChange={(value) =>
        setSearchParams(
          (prev) => {
            const next = new URLSearchParams(prev)
            next.set(entitySearchParams.tab, String(value))
            return next
          },
          { replace: true },
        )
      }
    >
      <TabsList className="w-full justify-start overflow-x-auto overflow-y-hidden">
        <TabsTrigger value="tasks">
          {label('tasks', tasksList.title)}
        </TabsTrigger>
        {relations.map((relation) => (
          <TabsTrigger key={relation} value={relation}>
            {label(relation, relationLists[relation].title)}
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value="tasks" className="pt-2">
        <TasksTab kind={kind} id={id} />
      </TabsContent>
      {relations.map((relation) => (
        <TabsContent key={relation} value={relation} className="pt-2">
          <RelationTab
            config={relationLists[relation]}
            rows={overview.data?.directRelations[relation] ?? []}
            query={overview}
          />
        </TabsContent>
      ))}
    </Tabs>
  )
}
