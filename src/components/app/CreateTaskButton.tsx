import { useMemo, useState } from 'react'
import { useStore } from '@/store'
import { Logger } from '@c/Logger'
import { Priority, ProgressStatus, Task, WithAttachments } from '@c/types/index'
import { resolveTaskSchedule } from '@c/taskSchedule'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import {
  createTaskFields,
  EntityFormDialog,
} from '@/components/ui/custom/entityForms'

// The rule only gets submitted while `is_recurring` is on (see `visibleWhen`
// in the task fields), so seeding it here just gives the editor a starting value.
const taskDefaultValues: Partial<WithAttachments<Task['Write']>> = {
  status: ProgressStatus.PLANNED,
  priority: Priority.MEDIUM,
  is_recurring: false,
  recurrance_rule: { type: 'daily', data: {} },
}

export const CreateTaskButtonComponent = () => {
  const tasks = useStore((state) => state.tasks)
  const projects = useStore((state) => state.projects)
  const areas = useStore((state) => state.areas)
  const goals = useStore((state) => state.goals)

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | undefined>(
    undefined,
  )

  const fields = useMemo(
    () =>
      createTaskFields({
        projects: projects.data,
        areas: areas.data,
        goals: goals.data,
      }),
    [projects.data, areas.data, goals.data],
  )

  const openDialog = () => {
    setErrorMessage(undefined)
    setIsDialogOpen(true)
  }

  const handleSubmit = async (
    values: Partial<WithAttachments<Task['Write']>>,
  ) => {
    setIsSubmitting(true)
    setErrorMessage(undefined)
    try {
      await tasks.add(values as WithAttachments<Task['Write']>)
      // Newly created tags should show up in the tag list and pickers
      if (values.tags?.length)
        useStore
          .getState()
          .tags.fetch()
          .catch(() => {})
      setIsDialogOpen(false)
    } catch (error) {
      Logger.getInstance().error(`Failed to create task: ${String(error)}`)
      setErrorMessage(
        'Could not create the task. Please check the details and try again.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <Button size="default" onClick={openDialog} className="gap-1.5">
        <Plus className="size-4" />
        <strong>New Task</strong>
      </Button>

      <EntityFormDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        title="New task"
        description="Add a new task to your list."
        fields={fields}
        initialValues={taskDefaultValues}
        onSubmit={handleSubmit}
        transformValues={resolveTaskSchedule}
        submitLabel="Create task"
        isSubmitting={isSubmitting}
        errorMessage={errorMessage}
      />
    </>
  )
}
