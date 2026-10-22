import React, { useId, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { ColorPicker } from '@/components/ui/custom/ColorPicker'
import { IconPicker } from '@/components/ui/custom/IconPicker'
import { RecurranceRuleInput } from '@/components/ui/custom/RecurranceRuleInput'
import { RecurranceRule } from '@d/database/schemas'
import { CalendarIcon, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { FieldConfig } from './types'
import { isBlank } from './utils'
import { dateToStartOfDayMillis, formatDdMmYyyy } from '@c/datetimeUtils'

const NONE_VALUE = '__none__'

export interface GenericFormProps<T extends object> {
  fields: FieldConfig<T>[]
  /** Initial values used to seed the form. Resets whenever the form remounts. */
  initialValues?: Partial<T>
  onSubmit: (values: Partial<T>) => void | Promise<void>
  onCancel?: () => void
  submitLabel?: string
  cancelLabel?: string
  isSubmitting?: boolean
  /** Renders the values read-only (all controls disabled, submit hidden). */
  readOnly?: boolean
  /** Optional error surfaced above the footer (e.g. from a failed submit). */
  errorMessage?: string
  className?: string
}

/**
 * A schema driven form. It renders a control for every entry in `fields` and
 * returns the collected values through `onSubmit`. Because `FieldConfig` is
 * constrained to the keys of `T`, the form stays fully type-safe for any entity.
 */
export function GenericForm<T extends object>({
  fields,
  initialValues,
  onSubmit,
  onCancel,
  submitLabel = 'Save',
  cancelLabel = 'Cancel',
  isSubmitting = false,
  readOnly = false,
  errorMessage,
  className,
}: GenericFormProps<T>) {
  const formId = useId()
  const [values, setValues] = useState<Partial<T>>(initialValues ?? {})
  const [errors, setErrors] = useState<Record<string, string>>({})

  const setValue = (name: Extract<keyof T, string>, value: unknown) => {
    setValues((prev) => ({ ...prev, [name]: value }) as Partial<T>)
    setErrors((prev) => {
      if (!prev[name]) return prev
      const next = { ...prev }
      delete next[name]
      return next
    })
  }

  const visibleFields = fields.filter(
    (field) => !field.visibleWhen || field.visibleWhen(values),
  )

  const validate = (): boolean => {
    const nextErrors: Record<string, string> = {}
    for (const field of visibleFields) {
      if (field.required && isBlank(values[field.name])) {
        nextErrors[field.name] = `${field.label} is required`
      }

      if (
        field.noSpacesAllowed &&
        values[field.name] &&
        typeof values[field.name] === 'string'
      ) {
        if ((values[field.name] as string).includes(' ')) {
          nextErrors[field.name] = `${field.label} cannot contain spaces`
        }
      }

      if (
        field.validate &&
        !nextErrors[field.name] &&
        !isBlank(values[field.name])
      ) {
        const message = field.validate(values[field.name])
        if (message) nextErrors[field.name] = message
      }
    }
    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (readOnly || isSubmitting) return
    if (!validate()) return
    // Hidden fields are reset to null so that edits clear any stale value.
    const submitted: Record<string, unknown> = { ...values }
    for (const field of fields) {
      if (!visibleFields.includes(field)) submitted[field.name] = null
    }
    await onSubmit(submitted as Partial<T>)
  }

  return (
    <form
      id={formId}
      onSubmit={handleSubmit}
      className={cn('space-y-4', className)}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {visibleFields.map((field) => (
          <FormField
            key={field.name}
            field={field}
            fieldId={`${formId}-${field.name}`}
            value={values[field.name]}
            error={errors[field.name]}
            disabled={readOnly || field.disabled}
            onChange={(value) => setValue(field.name, value)}
          />
        ))}
      </div>

      {errorMessage && (
        <p className="text-sm text-destructive" role="alert">
          {errorMessage}
        </p>
      )}

      <div className="flex justify-end gap-2 pt-2">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            {cancelLabel}
          </Button>
        )}
        {!readOnly && (
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="size-4 animate-spin" />}
            {submitLabel}
          </Button>
        )}
      </div>
    </form>
  )
}

interface FormFieldProps<T extends object> {
  field: FieldConfig<T>
  fieldId: string
  value: unknown
  error?: string
  disabled?: boolean
  onChange: (value: unknown) => void
}

function FormField<T extends object>({
  field,
  fieldId,
  value,
  error,
  disabled,
  onChange,
}: FormFieldProps<T>) {
  const Icon = field.icon
  const descriptionId = `${fieldId}-description`
  const errorId = `${fieldId}-error`

  const renderControl = () => {
    switch (field.type) {
      case 'textarea':
        return (
          <Textarea
            id={fieldId}
            value={value === undefined || value === null ? '' : String(value)}
            placeholder={field.placeholder}
            disabled={disabled}
            rows={4}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : undefined}
            onChange={(event) => onChange(event.target.value)}
          />
        )
      case 'number':
        return (
          <Input
            id={fieldId}
            type="number"
            value={value === undefined || value === null ? '' : String(value)}
            placeholder={field.placeholder}
            disabled={disabled}
            min={field.min}
            max={field.max}
            step={field.step}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : undefined}
            onChange={(event) =>
              onChange(
                event.target.value === ''
                  ? undefined
                  : Number(event.target.value),
              )
            }
          />
        )
      case 'select':
        return (
          <Select
            value={
              value === undefined || value === null || value === ''
                ? NONE_VALUE
                : String(value)
            }
            disabled={disabled}
            onValueChange={(next) =>
              onChange(next === NONE_VALUE ? undefined : next)
            }
          >
            <SelectTrigger
              id={fieldId}
              className="w-full"
              aria-invalid={Boolean(error)}
            >
              <SelectValue placeholder={field.placeholder ?? 'Select...'} />
            </SelectTrigger>
            <SelectContent>
              {field.allowEmpty && (
                <SelectItem value={NONE_VALUE}>
                  {field.placeholder ?? 'None'}
                </SelectItem>
              )}
              {field.options?.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )
      case 'boolean':
        return (
          <div className="flex h-9 items-center gap-2">
            <Switch
              id={fieldId}
              checked={Boolean(value)}
              disabled={disabled}
              onCheckedChange={(checked) => onChange(checked)}
            />
            <span className="text-sm text-muted-foreground">
              {value ? 'Yes' : 'No'}
            </span>
          </div>
        )
      case 'date':
        return (
          <DateFieldControl
            fieldId={fieldId}
            value={value}
            disabled={disabled}
            placeholder={field.placeholder}
            hasError={Boolean(error)}
            onChange={onChange}
          />
        )
      case 'color':
        return (
          <ColorPicker
            id={fieldId}
            value={typeof value === 'string' ? value : undefined}
            disabled={disabled}
            placeholder={field.placeholder}
            hasError={Boolean(error)}
            onChange={onChange}
          />
        )
      case 'icon':
        return (
          <IconPicker
            id={fieldId}
            value={typeof value === 'string' ? value : undefined}
            disabled={disabled}
            placeholder={field.placeholder}
            hasError={Boolean(error)}
            onChange={onChange}
          />
        )
      case 'recurrance':
        // A disabled fieldset disables every control inside the editor.
        return (
          <fieldset
            id={fieldId}
            disabled={disabled}
            className="min-w-0 rounded-md border p-3"
          >
            <RecurranceRuleInput
              value={value as RecurranceRule | null | undefined}
              onChange={onChange}
            />
          </fieldset>
        )
      case 'text':
      default:
        return (
          <Input
            id={fieldId}
            value={value === undefined || value === null ? '' : String(value)}
            placeholder={field.placeholder}
            disabled={disabled}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : undefined}
            onChange={(event) => onChange(event.target.value)}
          />
        )
    }
  }

  return (
    <div className={cn(field.colSpan === 2 && 'sm:col-span-2')}>
      <div className="space-y-2">
        <Label htmlFor={fieldId}>
          {Icon && <Icon className="size-4 text-muted-foreground" />}
          {field.label}
          {field.required && <span className="text-destructive">*</span>}
        </Label>
        {renderControl()}
        {field.description && !error && (
          <p id={descriptionId} className="text-xs text-muted-foreground">
            {field.description}
          </p>
        )}
        {error && (
          <p id={errorId} className="text-xs text-destructive">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}

interface DateFieldControlProps {
  fieldId: string
  value: unknown
  disabled?: boolean
  placeholder?: string
  hasError?: boolean
  onChange: (value: unknown) => void
}

function DateFieldControl({
  fieldId,
  value,
  disabled,
  placeholder,
  hasError,
  onChange,
}: DateFieldControlProps) {
  const [isOpen, setIsOpen] = useState(false)
  const selectedDate = typeof value === 'number' ? new Date(value) : undefined

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          id={fieldId}
          type="button"
          variant="outline"
          disabled={disabled}
          aria-invalid={hasError}
          className={cn(
            'w-full justify-start gap-2 font-normal',
            !selectedDate && 'text-muted-foreground',
          )}
        >
          <CalendarIcon className="size-4" />
          {selectedDate
            ? formatDdMmYyyy(selectedDate)
            : (placeholder ?? 'Pick a date')}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="single"
          selected={selectedDate}
          autoFocus
          onSelect={(date) => {
            onChange(date ? dateToStartOfDayMillis(date) : undefined)
            setIsOpen(false)
          }}
        />
        {selectedDate && (
          <div className="border-t p-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full text-muted-foreground"
              onClick={() => {
                onChange(undefined)
                setIsOpen(false)
              }}
            >
              Clear date
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
