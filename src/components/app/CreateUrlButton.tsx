import { useMemo, useState } from 'react'
import { useStore } from '@/store'
import { Logger } from '@c/Logger'
import { EntityUrl } from '@c/types/index'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import {
  createUrlFields,
  EntityFormDialog,
} from '@/components/ui/custom/entityForms'

export const CreateUrlButtonComponent = () => {
  const urls = useStore((state) => state.urls)

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | undefined>(
    undefined,
  )

  const fields = useMemo(() => createUrlFields(), [])

  const openDialog = () => {
    setErrorMessage(undefined)
    setIsDialogOpen(true)
  }

  const handleSubmit = async (values: Partial<EntityUrl['Write']>) => {
    setIsSubmitting(true)
    setErrorMessage(undefined)
    try {
      await urls.add(values as EntityUrl['Write'])
      setIsDialogOpen(false)
    } catch (error) {
      Logger.getInstance().error(`Failed to create URL: ${String(error)}`)
      setErrorMessage(
        'Could not save the URL. It may already be saved, or the address is invalid.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <Button size="default" onClick={openDialog} className="gap-1.5">
        <Plus className="size-4" />
        <strong>New URL</strong>
      </Button>

      <EntityFormDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        title="New URL"
        description="Save a link to reference from your tasks."
        fields={fields}
        onSubmit={handleSubmit}
        submitLabel="Save URL"
        isSubmitting={isSubmitting}
        errorMessage={errorMessage}
      />
    </>
  )
}
