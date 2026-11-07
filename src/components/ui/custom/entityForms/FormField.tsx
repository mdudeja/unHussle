import type { FieldConfig } from './types'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { ColorPicker } from '@/components/ui/custom/ColorPicker'
import { IconPicker } from '@/components/ui/custom/IconPicker'
import { RecurranceRuleInput } from '@/components/ui/custom/RecurranceRuleInput'
import { TagsInput } from '@/components/ui/custom/TagsInput'
import { UrlsInput } from '@/components/ui/custom/UrlsInput'
import { PickPathButtons } from '@/components/ui/custom/PickPathButtons'
import {
  EntityRefsInput,
  type EntityRef,
} from '@/components/ui/custom/EntityRefsInput'
import { DateTimePicker } from '@/components/ui/custom/DateTimePicker'
import { TaskAnchorInput } from '@/components/ui/custom/TaskAnchorInput'
import { RecurranceRule } from '@d/database/schemas'
import type { TagInput, UrlInput } from '@c/types/index'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DateFieldControl } from '@/components/ui/custom/entityForms/DateFieldControl'
import { cn } from '@/lib/utils'

interface FormFieldProps<T extends object> {
  field: FieldConfig<T>
  fieldId: string
  value: unknown
  error?: string
  disabled?: boolean
  onChange: (value: unknown) => void
}

const NONE_VALUE = 'None'

// Text-like controls only render primitive values; anything else shows as empty.
const toTextLikeInputValue = (value: unknown) =>
  typeof value === 'string' ||
  typeof value === 'number' ||
  typeof value === 'boolean'
    ? String(value)
    : ''

export function FormField<T extends object>({
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
      case 'taskAnchor':
        return (
          <TaskAnchorInput
            value={typeof value === 'string' ? value : null}
            disabled={disabled}
            onChange={onChange}
          />
        )
      case 'textarea':
        return (
          <Textarea
            id={fieldId}
            value={toTextLikeInputValue(value)}
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
            value={toTextLikeInputValue(value)}
            placeholder={field.placeholder}
            disabled={disabled}
            min={field.min}
            max={field.max}
            step={field.step}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : undefined}
            onChange={(event) =>
              onChange(
                event.target.value === '' ? null : Number(event.target.value),
              )
            }
          />
        )
      case 'select':
        return (
          <Select
            items={field.options ?? []}
            value={toTextLikeInputValue(value) || NONE_VALUE}
            disabled={disabled}
            onValueChange={(next) =>
              onChange(next === NONE_VALUE ? null : next)
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
      case 'datetime':
        return (
          <DateTimePicker
            id={fieldId}
            value={typeof value === 'number' ? value : undefined}
            disabled={disabled}
            placeholder={field.placeholder}
            hasError={Boolean(error)}
            className="w-full"
            onChange={(next) => onChange(next ?? null)}
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
      case 'tags':
        return (
          <TagsInput
            id={fieldId}
            value={value as TagInput[] | null | undefined}
            disabled={disabled}
            placeholder={field.placeholder}
            hasError={Boolean(error)}
            onChange={onChange}
          />
        )
      case 'url':
        return (
          <div className="flex gap-2">
            <Input
              id={fieldId}
              value={toTextLikeInputValue(value)}
              placeholder={field.placeholder}
              disabled={disabled}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? errorId : undefined}
              onChange={(event) => onChange(event.target.value)}
            />
            <PickPathButtons disabled={disabled} onPick={onChange} />
          </div>
        )
      case 'urls':
        return (
          <UrlsInput
            id={fieldId}
            value={value as UrlInput[] | null | undefined}
            disabled={disabled}
            placeholder={field.placeholder}
            hasError={Boolean(error)}
            onChange={onChange}
          />
        )
      case 'resources':
        return (
          <EntityRefsInput
            id={fieldId}
            kinds={['resources']}
            value={value as EntityRef[] | null | undefined}
            disabled={disabled}
            hasError={Boolean(error)}
            placeholder={field.placeholder ?? 'Search resources…'}
            onChange={onChange}
          />
        )
      case 'resourceLinks':
        return (
          <EntityRefsInput
            id={fieldId}
            kinds={['tasks', 'projects', 'areas', 'goals']}
            value={value as EntityRef[] | null | undefined}
            disabled={disabled}
            hasError={Boolean(error)}
            placeholder={field.placeholder ?? 'Search tasks and collections…'}
            onChange={onChange}
          />
        )
      case 'text':
      default:
        return (
          <Input
            id={fieldId}
            value={toTextLikeInputValue(value)}
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
