import { useMemo, useState } from 'react'
import { useStore } from '@/store'
import { Logger } from '@c/Logger'
import { Priority, Area, WithSupporters } from '@c/types/index'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import {
  createAreaFields,
  EntityFormDialog,
} from '@/components/ui/custom/entityForms'

const areaDefaultValues: Partial<WithSupporters<Area['Write']>> = {
  priority: Priority.MEDIUM,
}

export const CreateAreaButtonComponent = () => {
  const areas = useStore((state) => state.areas)

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | undefined>(
    undefined,
  )

  const fields = useMemo(() => createAreaFields(), [])

  const openDialog = () => {
    setErrorMessage(undefined)
    setIsDialogOpen(true)
  }

  const handleSubmit = async (
    values: Partial<WithSupporters<Area['Write']>>,
  ) => {
    setIsSubmitting(true)
    setErrorMessage(undefined)
    try {
      await areas.add(values as WithSupporters<Area['Write']>)
      setIsDialogOpen(false)
    } catch (error) {
      Logger.getInstance().error('Failed to create area', { error })
      setErrorMessage(
        'Could not create the project. Please check the details and try again.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <Button size="default" onClick={openDialog} className="gap-1.5">
        <Plus className="size-4" />
        <strong>New Area</strong>
      </Button>

      <EntityFormDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        title="New Area"
        description="Add a new area to align tasks against."
        fields={fields}
        initialValues={areaDefaultValues}
        onSubmit={handleSubmit}
        submitLabel="Create area"
        isSubmitting={isSubmitting}
        errorMessage={errorMessage}
      />
    </>
  )
}
