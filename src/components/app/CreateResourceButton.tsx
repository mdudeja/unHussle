import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { useStore } from '@/store'
import { Logger } from '@c/Logger'
import { Resource } from '@c/types/index'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import {
  createResourceFields,
  EntityFormDialog,
} from '@/components/ui/custom/entityForms'
import { getResourceRoute } from '@/lib/entityRoutes'

/** Creates the resource (and its empty file), then opens it in the editor. */
export const CreateResourceButtonComponent = () => {
  const resources = useStore((state) => state.resources)
  const navigate = useNavigate()

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | undefined>(
    undefined,
  )

  const fields = useMemo(() => createResourceFields(), [])

  const openDialog = () => {
    setErrorMessage(undefined)
    setIsDialogOpen(true)
  }

  const handleSubmit = async (values: Record<string, unknown>) => {
    setIsSubmitting(true)
    setErrorMessage(undefined)
    try {
      const created = await resources.add(values as Resource['Write'])
      setIsDialogOpen(false)
      void navigate(getResourceRoute(created.id))
    } catch (error) {
      Logger.getInstance().error('Failed to create resource', { error })
      setErrorMessage(
        error instanceof Error && error.message
          ? error.message
          : 'Could not create the resource.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <Button size="default" onClick={openDialog} className="gap-1.5">
        <Plus className="size-4" />
        <strong>New Resource</strong>
      </Button>

      <EntityFormDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        title="New resource"
        description="A markdown note saved in your vault."
        fields={fields}
        onSubmit={handleSubmit}
        submitLabel="Create and open"
        isSubmitting={isSubmitting}
        errorMessage={errorMessage}
      />
    </>
  )
}
