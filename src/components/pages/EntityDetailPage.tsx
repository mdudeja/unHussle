import { Link, useNavigate, useParams } from 'react-router'
import { ChevronLeft, Loader2 } from 'lucide-react'
import { useEntryDetail } from '@/workflows/hooks'
import { Button } from '@/components/ui/button'
import StatusView from '@/components/ui/custom/StatusView'
import PriorityView from '@/components/ui/custom/PriorityView'
import { EntityIcon } from '@/components/ui/custom/list/fields'
import { EntityActionBar } from '@/components/app'
import type { EntityListConfig } from '@/components/app/entity-list'
import type { EntityRow } from '@/components/app/entity-list-row'
import {
  entityRegistry,
  getEntityTitle,
  useCommonActions,
} from '@/lib/entityActions'
import { entityRoutes } from '@/lib/entityRoutes'

export type EntityDetailConfig<T> = {
  list: EntityListConfig<T>
  /** Everything below the header, e.g. tabs of related items. */
  renderBody: (item: T) => React.ReactNode
}

const NO_ACTIONS = () => []

/** The page of one item: its details, its actions and its related items. */
export function EntityDetailPage<
  T extends EntityRow & { description?: string | null },
>({ config }: { config: EntityDetailConfig<T> }) {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { kind, icon, renderMeta } = config.list
  const { label } = entityRegistry[kind]
  const noun = `${label}s`
  const listRoute = entityRoutes[kind]
  const query = useEntryDetail(kind, id)
  const item = query.data as T | null
  const useActions = config.list.useActions ?? NO_ACTIONS
  const actions = [
    ...useActions(),
    ...useCommonActions<T>(kind, {
      onDeleted: () => void navigate(listRoute, { replace: true }),
    }),
  ]

  const renderContent = () => {
    if (item) {
      return (
        <>
          <header className="flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <EntityIcon icon={item.icon} color={item.color} fallback={icon} />
              <div className="flex min-w-0 flex-col gap-2">
                <h1 className="text-2xl font-semibold break-words">
                  {getEntityTitle(item)}
                </h1>
                {(item.status || item.priority) && (
                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    <StatusView status={item.status} />
                    <PriorityView priority={item.priority} />
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                  {renderMeta?.(item)}
                </div>
                {item.description && (
                  <p className="text-sm text-muted-foreground">
                    {item.description}
                  </p>
                )}
              </div>
            </div>
            <EntityActionBar item={item} actions={actions} />
          </header>
          {config.renderBody(item)}
        </>
      )
    }
    if (query.isLoading) {
      return (
        <p
          className="flex justify-center py-10"
          aria-label={`Loading ${label}`}
        >
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </p>
      )
    }
    return (
      <section className="flex flex-col items-center gap-3 py-10 text-center">
        <p role="alert" className="text-sm text-muted-foreground">
          {query.error
            ? `Could not load this ${label}. Check your connection, then try again.`
            : `This ${label} does not exist. It may have been deleted.`}
        </p>
        {query.error ? (
          <Button type="button" variant="outline" onClick={query.retry}>
            Try again
          </Button>
        ) : (
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link to={listRoute} />}
          >
            Go to all {noun}
          </Button>
        )}
      </section>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <nav aria-label="Breadcrumb">
        <Link
          to={listRoute}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          All {noun}
        </Link>
      </nav>
      {renderContent()}
    </div>
  )
}
