import { Link, useNavigate, useParams } from 'react-router'
import { AlertTriangle, ArrowLeft, Trash2 } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ResourceEditor } from '@/components/app/resources/ResourceEditor'
import { ResourceMetaPanel } from '@/components/app/resources/ResourceMetaPanel'
import { entityRoutes } from '@/lib/entityRoutes'
import { useEntryDetail, useResourceContent } from '@/workflows/hooks'
import { useStore } from '@/store'
import type { HydratedResource } from '@c/types/Hydrated'
import { Logger } from '@c/Logger'

/** `/resources/:id`: the markdown editor with the resource's details beside it. */
export default function ResourceEditorPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { remove } = useStore((state) => state.resources)
  const detail = useEntryDetail('resources', id)
  const content = useResourceContent(id)
  const resource = detail.data as HydratedResource | null

  if (detail.error || content.error)
    return (
      <div className="space-y-3 p-6">
        <p role="alert">This resource could not be loaded.</p>
        <Link to={entityRoutes.resources} className="underline">
          Back to resources
        </Link>
      </div>
    )

  if (!resource || !content.data)
    return (
      <div className="space-y-3 p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-[50vh] w-full" />
      </div>
    )

  const deleteResource = async () => {
    if (
      !window.confirm(
        `Delete "${resource.title}"? Its file moves to the vault's .trash folder.`,
      )
    )
      return
    try {
      await remove(resource.id)
      void navigate(entityRoutes.resources)
    } catch (error) {
      Logger.getInstance().error('Failed to delete resource', { error })
    }
  }

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <header className="flex items-center gap-3">
        <Link
          to={entityRoutes.resources}
          aria-label="Back to resources"
          className={buttonVariants({ variant: 'ghost', size: 'icon' })}
        >
          <ArrowLeft className="size-4" />
        </Link>
        <h1 className="flex-1 truncate text-2xl font-semibold">
          {resource.title}
        </h1>
        <Button variant="outline" onClick={() => void deleteResource()}>
          <Trash2 className="size-4" />
          Delete
        </Button>
      </header>

      {content.data.missing && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm"
        >
          <AlertTriangle className="size-4 text-warning" />
          The file is missing from the vault. Writing here recreates it; or
          delete the resource.
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col gap-6 lg:flex-row">
        {/* Keyed by id so another resource gets a fresh editor and autosave. */}
        <ResourceEditor key={resource.id} initial={content.data} />
        <ResourceMetaPanel
          key={`${resource.id}:${resource.updated_at}`}
          resource={resource}
          path={content.data.path}
        />
      </div>
    </div>
  )
}
