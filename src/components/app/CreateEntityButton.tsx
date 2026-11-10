import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EntityFormDialog } from '@/components/ui/custom/entityForms'
import { entityRegistry, type EntityKind } from '@/lib/entityActions'
import {
  useEntityFields,
  useEntitySubmission,
} from '@/lib/entityActions/useEntityForm'

export function CreateEntityButton({ kind }: { kind: EntityKind }) {
  const [open, setOpen] = useState(false)
  const entry = entityRegistry[kind]
  const label =
    entry.label === 'URL'
      ? 'URL'
      : entry.label[0].toUpperCase() + entry.label.slice(1)
  return (
    <>
      <Button size="default" onClick={() => setOpen(true)} className="gap-1.5">
        <Plus className="size-4" />
        <strong>New {label}</strong>
      </Button>
      {open && <CreateEntityDialog kind={kind} close={() => setOpen(false)} />}
    </>
  )
}

function CreateEntityDialog({
  kind,
  close,
}: {
  kind: EntityKind
  close: () => void
}) {
  const navigate = useNavigate()
  const entry = entityRegistry[kind]
  const fields = useEntityFields(kind)
  const submission = useEntitySubmission(kind, (created) => {
    close()
    if (entry.createdRoute) void navigate(entry.createdRoute(created.id))
  })
  return (
    <EntityFormDialog<Record<string, unknown>>
      open
      onOpenChange={(open) => {
        if (!open && !submission.isSubmitting) close()
      }}
      title={`New ${entry.label}`}
      description={entry.createDescription}
      fields={fields}
      initialValues={entry.createDefaults}
      onSubmit={submission.submit}
      submitLabel={entry.createSubmitLabel ?? `Create ${entry.label}`}
      isSubmitting={submission.isSubmitting}
      errorMessage={submission.errorMessage}
    />
  )
}
