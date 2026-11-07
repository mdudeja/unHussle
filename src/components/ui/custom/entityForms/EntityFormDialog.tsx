import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { GenericForm, FieldConfig } from '@/components/ui/custom/entityForms'

export interface EntityFormDialogProps<T extends object> {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  fields: FieldConfig<T>[]
  initialValues?: Partial<T>
  onSubmit: (values: Partial<T>) => void | Promise<void>
  transformValues?: (values: Partial<T>) => Partial<T>
  submitLabel?: string
  cancelLabel?: string
  isSubmitting?: boolean
  errorMessage?: string
  /** Shows the entity values read-only (no submit button). */
  readOnly?: boolean
}

/**
 * Dialog wrapper around {@link GenericForm}. Used to create/edit an entity
 * without leaving the current view.
 */
export function EntityFormDialog<T extends object>({
  open,
  onOpenChange,
  title,
  description,
  fields,
  initialValues,
  onSubmit,
  transformValues,
  submitLabel,
  cancelLabel,
  isSubmitting,
  errorMessage,
  readOnly,
}: EntityFormDialogProps<T>) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <GenericForm
          fields={fields}
          initialValues={initialValues}
          onSubmit={onSubmit}
          transformValues={transformValues}
          onCancel={() => onOpenChange(false)}
          submitLabel={submitLabel}
          cancelLabel={cancelLabel}
          isSubmitting={isSubmitting}
          errorMessage={errorMessage}
          readOnly={readOnly}
        />
      </DialogContent>
    </Dialog>
  )
}
