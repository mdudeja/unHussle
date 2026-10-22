import { useMemo, useState } from 'react'
import { useStore } from '@/store'
import { Priority, ProgressStatus, Goal } from '@c/types/index'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import {
  createGoalFields,
  EntityFormDialog,
} from '@/components/ui/custom/entityForms'

const goalDefaultValues: Partial<Goal['Write']> = {
  status: ProgressStatus.PLANNED,
  priority: Priority.MEDIUM,
}

export const CreateGoalButtonComponent = () => {
  const areas = useStore((state) => state.areas)
  const goals = useStore((state) => state.goals)

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | undefined>(
    undefined,
  )

  const fields = useMemo(
    () => createGoalFields({ areas: areas.data }),
    [areas.data],
  )

  const openDialog = () => {
    setErrorMessage(undefined)
    setIsDialogOpen(true)
  }

  const handleSubmit = async (values: Partial<Goal['Write']>) => {
    setIsSubmitting(true)
    setErrorMessage(undefined)
    try {
      await goals.add(values as Goal['Write'])
      setIsDialogOpen(false)
    } catch (error) {
      console.error('Failed to create goal:', error)
      setErrorMessage(
        'Could not create the goal. Please check the details and try again.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <Button size="default" onClick={openDialog} className="gap-1.5">
        <Plus className="size-4" />
        <strong>New Goal</strong>
      </Button>

      <EntityFormDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        title="New goal"
        description="Add a new goal to align tasks against."
        fields={fields}
        initialValues={goalDefaultValues}
        onSubmit={handleSubmit}
        submitLabel="Create goal"
        isSubmitting={isSubmitting}
        errorMessage={errorMessage}
      />
    </>
  )
}
