import { useState } from 'react'
import { useNavigate } from 'react-router'
import { FileText, Paperclip } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import UrlView from '@/components/ui/custom/UrlView'
import TagsView from '@/components/ui/custom/TagsView'
import { getEntityItemRoute, getResourceRoute } from '@/lib/entityRoutes'
import { useTaskContext } from '@/workflows/hooks'
import type { ContextItems } from '@c/types/Hydrated'

const sourceLabels = { projects: 'Project', goals: 'Goal', areas: 'Area' }

const countOf = ({ resources, urls }: ContextItems) =>
  resources.length + urls.length

function Group({
  title,
  items,
  onOpenResource,
}: {
  title: React.ReactNode
  items: ContextItems
  onOpenResource: (id: string) => void
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
                onClick={() => onOpenResource(resource.id)}
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
 * A chip on the task card that opens everything the task brings along: its
 * own resources and links, then those of its project, goal and area.
 */
export function TaskContextSheet({ taskId }: { taskId: string }) {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const context = useTaskContext(taskId)
  const data = context.data
  const count = data
    ? countOf(data.own) +
      data.inherited.reduce((sum, group) => sum + countOf(group), 0)
    : 0
  if (!data || count === 0) return null

  const openResource = (id: string) => {
    setOpen(false)
    void navigate(getResourceRoute(id))
  }
  const hasOwn = countOf(data.own) > 0 || data.own.tags.length > 0

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Paperclip className="size-4" />
        {count} {count === 1 ? 'resource' : 'resources'}
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Resources for this task</SheetTitle>
            <SheetDescription>
              Including those from its project, goal and area.
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-5 px-4 pb-4">
            {hasOwn && (
              <Group
                title="This task"
                items={data.own}
                onOpenResource={openResource}
              />
            )}
            {data.inherited.map((group) => (
              <Group
                key={group.source.id}
                title={
                  <button
                    type="button"
                    className="hover:underline"
                    onClick={() => {
                      setOpen(false)
                      void navigate(
                        getEntityItemRoute(group.source.kind, group.source.id),
                      )
                    }}
                  >
                    {sourceLabels[group.source.kind]}: {group.source.title}
                  </button>
                }
                items={group}
                onOpenResource={openResource}
              />
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
