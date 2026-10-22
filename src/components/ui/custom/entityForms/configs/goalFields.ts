import {
  Activity,
  AlignLeft,
  Calendar,
  Flag,
  Layers,
  Target,
  TrendingUp,
  Hash,
  Link,
} from 'lucide-react'
import { Area, Goal, WithAttachments } from '@c/types/index'
import type { FieldConfig, FieldOption } from '../types'
import { priorityOptions, statusOptions } from '../utils'

export const createGoalFields = ({
  areas,
}: {
  areas: Area['Read'][]
}): FieldConfig<WithAttachments<Goal['Write']>>[] => {
  const areaOptions: FieldOption[] = areas.map((area) => ({
    label: area.title,
    value: area.id,
  }))

  return [
    {
      name: 'title',
      label: 'Name',
      type: 'text',
      required: true,
      colSpan: 2,
      placeholder: 'What do you want to achieve?',
      icon: Target,
    },
    {
      name: 'description',
      label: 'Description',
      type: 'textarea',
      colSpan: 2,
      placeholder: 'Optional details...',
      icon: AlignLeft,
    },
    {
      name: 'status',
      label: 'Status',
      type: 'select',
      options: statusOptions,
      icon: Activity,
    },
    {
      name: 'priority',
      label: 'Priority',
      type: 'select',
      options: priorityOptions,
      icon: Flag,
    },
    {
      name: 'area_id',
      label: 'Area',
      type: 'select',
      options: areaOptions,
      allowEmpty: true,
      placeholder: 'No area',
      icon: Layers,
    },
    {
      name: 'due_date',
      label: 'Due date',
      type: 'date',
      placeholder: 'No due date',
      icon: Calendar,
    },
    {
      name: 'progress',
      label: 'Progress (%)',
      type: 'number',
      min: 0,
      max: 100,
      step: 1,
      placeholder: '0',
      icon: TrendingUp,
    },
    {
      name: 'tags',
      label: 'Tags',
      type: 'tags',
      colSpan: 2,
      icon: Hash,
    },
    {
      name: 'urls',
      label: 'Links',
      type: 'urls',
      colSpan: 2,
      icon: Link,
    },
  ]
}
