import React, { useState } from 'react'
import { Task, Priority, ProgressStatus } from '@c/types/index'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { RecurranceRuleInput } from '@/components/ui/custom/RecurranceRuleInput'
import {
  Smile,
  ClipboardList,
  Clock,
  Flag,
  Target,
  Layers,
  Link,
  Repeat,
  Tag,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type TaskFormProps = React.ComponentProps<'form'> & {
  initialData?: Task['Read']
  onSubmit: (data: Task['Write'] | Task['Update']) => Promise<void>
  onCancel: () => void
  isLoading?: boolean
}

export const TaskFormComponent = ({
  initialData,
  onSubmit,
  onCancel,
  ref,
}: TaskFormProps) => {
  const [formData, setFormData] = useState<
    Partial<Task['Write'] | Task['Update']>
  >({
    title: '',
    description: '',
    status: ProgressStatus.PLANNED,
    priority: Priority.MEDIUM,
    is_fun: false,
    is_chore: false,
    is_recurring: false,
    estimated_minutes: 0,
    ...initialData,
  })

  // Handle Input Changes
  const handleChange = <K extends keyof Task['Write']>(
    field: K,
    value: Task['Write'][K],
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Basic Validation
    if (!formData.title?.trim()) return

    void onSubmit(formData as Task['Write'])
  }

  return (
    <form ref={ref} onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-text mb-1">
            Task Name
          </label>
          <Input
            placeholder="What needs to be done?"
            value={formData.title}
            onChange={(e) => handleChange('title', e.target.value)}
            className="text-lg font-medium"
            autoFocus
            required
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-text mb-1">
            Description
          </label>
          <Textarea
            placeholder="Add details, context, or sub-steps..."
            value={formData.description || ''}
            onChange={(e) => handleChange('description', e.target.value)}
            rows={3}
          />
        </div>

        {/* Priority & Status Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-text mb-1">
              Priority
            </label>
            <div className="flex gap-2">
              {(Object.values(Priority) as Priority[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => handleChange('priority', p)}
                  className={cn(
                    'px-3 py-1.5 rounded-md text-sm border transition-all',
                    formData.priority === p
                      ? 'bg-sage/10 border-sage text-sage font-medium ring-1 ring-sage'
                      : 'bg-surface border-border text-muted hover:bg-surface2',
                  )}
                >
                  <span className="capitalize">{p}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text mb-1">
              Status
            </label>
            <div className="relative">
              {/* Simple Native Select for now until we have a custom Select component */}
              <select
                value={formData.status ?? ProgressStatus.PLANNED}
                onChange={(e) =>
                  handleChange('status', e.target.value as ProgressStatus)
                }
                className="flex h-10 w-full items-center justify-between rounded-md border border-border bg-transparent px-3 py-2 text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-sage2 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {Object.values(ProgressStatus).map((s) => (
                  <option key={s} value={s}>
                    {s
                      .replace('_', ' ')
                      .replace(/\b\w/g, (l) => l.toUpperCase())}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Categories / Context (Placeholders) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Project */}
          <div className="opacity-60" title="Coming soon">
            <label className="flex items-center gap-2 text-sm font-medium text-text mb-1">
              <Flag size={14} className="text-muted" />
              Project
            </label>
            <Input placeholder="Select Project..." disabled />
          </div>

          {/* Area */}
          <div className="opacity-60" title="Coming soon">
            <label className="flex items-center gap-2 text-sm font-medium text-text mb-1">
              <Layers size={14} className="text-muted" />
              Area
            </label>
            <Input placeholder="Select Area..." disabled />
          </div>

          {/* Goal */}
          <div className="opacity-60" title="Coming soon">
            <label className="flex items-center gap-2 text-sm font-medium text-text mb-1">
              <Target size={14} className="text-muted" />
              Goal
            </label>
            <Input placeholder="Select Goal..." disabled />
          </div>

          {/* Resources */}
          <div className="opacity-60" title="Coming soon">
            <label className="flex items-center gap-2 text-sm font-medium text-text mb-1">
              <Link size={14} className="text-muted" />
              Resources (URLs)
            </label>
            <Input placeholder="Add URL..." disabled />
          </div>

          {/* Tags */}
          <div className="opacity-60 sm:col-span-2" title="Coming soon">
            <label className="flex items-center gap-2 text-sm font-medium text-text mb-1">
              <Tag size={14} className="text-muted" />
              Tags
            </label>
            <Input placeholder="Add tags..." disabled />
          </div>
        </div>

        {/* Recurring Settings */}
        <div className="space-y-3 pt-2 border-t border-border mt-2">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_recurring"
              checked={!!formData.is_recurring}
              onChange={(e) => {
                handleChange('is_recurring', e.target.checked)
                if (e.target.checked && !formData.recurrance_rule) {
                  handleChange('recurrance_rule', { type: 'daily', data: {} })
                }
              }}
              className="h-4 w-4 rounded border-border text-sage focus:ring-sage2"
            />
            <label
              htmlFor="is_recurring"
              className="text-sm font-medium text-text flex items-center gap-2"
            >
              <Repeat size={14} />
              Recurring Task
            </label>
          </div>

          {formData.is_recurring && (
            <RecurranceRuleInput
              className="ml-6"
              value={formData.recurrance_rule}
              onChange={(rule) => handleChange('recurrance_rule', rule)}
            />
          )}
        </div>

        {/* Flags & Meta Row */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-border">
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => handleChange('is_fun', !formData.is_fun)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-colors',
                formData.is_fun
                  ? 'bg-gold/10 border-gold text-gold font-medium'
                  : 'bg-surface border-border text-muted hover:bg-surface2',
              )}
            >
              <Smile size={16} />
              <span>Fun Task</span>
            </button>

            <button
              type="button"
              onClick={() => handleChange('is_chore', !formData.is_chore)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-colors',
                formData.is_chore
                  ? 'bg-muted/10 border-muted text-text font-medium'
                  : 'bg-surface border-border text-muted hover:bg-surface2',
              )}
            >
              <ClipboardList size={16} />
              <span>Chore</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Clock size={16} className="text-muted" />
            <Input
              type="number"
              min="0"
              className="w-24 text-right"
              placeholder="Min"
              value={formData.estimated_minutes || ''}
              onChange={(e) =>
                handleChange('estimated_minutes', parseInt(e.target.value) || 0)
              }
            />
            <span className="text-sm text-muted">min</span>
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t border-border">
        <Button variant="ghost" type="button" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={!formData.title}>
          {initialData ? 'Update Task' : 'Create Task'}
        </Button>
      </div>
    </form>
  )
}
