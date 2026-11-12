import { FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import UrlView from '@/components/ui/custom/UrlView'
import TagsView from '@/components/ui/custom/TagsView'
import { getEntityItemRoute, getResourceRoute } from '@/lib/entityRoutes'
import { contextCountOf } from '@/lib/task-context'
import type { ContextItems, TaskContext } from '@c/types/Hydrated'

const sourceLabels = { projects: 'Project', goals: 'Goal', areas: 'Area' }

function Group({
  title,
  items,
  onOpen,
}: {
  title: React.ReactNode
  items: ContextItems
  onOpen: (route: string) => void
}) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-medium">{title}</h3>
      {items.tags.length > 0 && <TagsView tags={items.tags} />}
      {items.resources.length > 0 && (
        <ul className="space-y-1">
          {items.resources.map((resource) => (
            <li key={resource.id}>
              <Button
                variant="ghost"
                className="h-auto w-full justify-start gap-2 px-2 py-1"
                onClick={() => onOpen(getResourceRoute(resource.id))}
              >
                <FileText className="size-4 shrink-0" />
                <span className="truncate">{resource.title}</span>
              </Button>
            </li>
          ))}
        </ul>
      )}
      {items.urls.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {items.urls.map((url) => (
            <UrlView key={url.id} url={url.url} />
          ))}
        </div>
      )}
    </section>
  )
}

/**
 * A task's own resources, links and tags, then those it inherits from its
 * project, goal and area. `onOpen` navigates to the given route.
 */
export function TaskContextList({
  context,
  onOpen,
}: {
  context: TaskContext
  onOpen: (route: string) => void
}) {
  const hasOwn = contextCountOf(context.own) > 0 || context.own.tags.length > 0
  return (
    <div className="space-y-5">
      {hasOwn && (
        <Group title="This task" items={context.own} onOpen={onOpen} />
      )}
      {context.inherited.map((group) => (
        <Group
          key={group.source.id}
          title={
            <button
              type="button"
              className="hover:underline"
              onClick={() =>
                onOpen(getEntityItemRoute(group.source.kind, group.source.id))
              }
            >
              {sourceLabels[group.source.kind]}: {group.source.title}
            </button>
          }
          items={group}
          onOpen={onOpen}
        />
      ))}
    </div>
  )
}
