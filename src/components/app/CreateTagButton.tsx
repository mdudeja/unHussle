import { useMemo, useState } from 'react'
import { useStore } from '@/store'
import { Logger } from '@c/Logger'
import { Tag } from '@c/types/index'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import {
  createTagFields,
  EntityFormDialog,
} from '@/components/ui/custom/entityForms'

export const CreateTagButtonComponent = () => {
  const tags = useStore((state) => state.tags)

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | undefined>(
    undefined,
  )

  const fields = useMemo(() => createTagFields(), [])

  const openDialog = () => {
    setErrorMessage(undefined)
    setIsDialogOpen(true)
  }

  const handleSubmit = async (values: Partial<Tag['Write']>) => {
    setIsSubmitting(true)
    setErrorMessage(undefined)
    try {
      await tags.add(values as Tag['Write'])
      setIsDialogOpen(false)
    } catch (error) {
      Logger.getInstance().error('Failed to create tag', { error })
      setErrorMessage(
        'Could not create the tag. A tag with this name may already exist.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <Button size="default" onClick={openDialog} className="gap-1.5">
        <Plus className="size-4" />
        <strong>New Tag</strong>
      </Button>

      <EntityFormDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        title="New tag"
        description="Add a new tag to label your tasks."
        fields={fields}
        onSubmit={handleSubmit}
        submitLabel="Create tag"
        isSubmitting={isSubmitting}
        errorMessage={errorMessage}
      />
    </>
  )
}
