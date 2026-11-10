import { useEntityReferences } from '@/lib/hooks/useEntityReferences'
import { useMemo, useState } from 'react'
import { useStore } from '@/store'
import { Logger } from '@c/Logger'
import { Priority, ProgressStatus } from '@c/types/enums'
import { Project, WithSupporters } from '@c/types/index'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import {
  createProjectFields,
  EntityFormDialog,
} from '@/components/ui/custom/entityForms'

const projectDefaultValues: Partial<WithSupporters<Project['Write']>> = {
  status: ProgressStatus.PLANNED,
  priority: Priority.MEDIUM,
}

export const CreateProjectButtonComponent = () => {
  const projects = useStore((state) => state.projects)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const areas = useEntityReferences('areas', isDialogOpen)
  const goals = useEntityReferences('goals', isDialogOpen)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | undefined>(
    undefined,
  )

  const fields = useMemo(
    () => createProjectFields({ areas: areas.data, goals: goals.data }),
    [areas.data, goals.data],
  )

  const openDialog = () => {
    setErrorMessage(undefined)
    setIsDialogOpen(true)
  }

  const handleSubmit = async (
    values: Partial<WithSupporters<Project['Write']>>,
  ) => {
    setIsSubmitting(true)
    setErrorMessage(undefined)
    try {
      await projects.add(values as WithSupporters<Project['Write']>)
      setIsDialogOpen(false)
    } catch (error) {
      Logger.getInstance().error('Failed to create project', { error })
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
        <strong>New Project</strong>
      </Button>

      <EntityFormDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        title="New project"
        description="Add a new project to organise your tasks."
        fields={fields}
        initialValues={projectDefaultValues}
        onSubmit={handleSubmit}
        submitLabel="Create project"
        isSubmitting={isSubmitting}
        errorMessage={errorMessage}
      />
    </>
  )
}
