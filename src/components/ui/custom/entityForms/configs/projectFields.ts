import {
  Activity,
  AlignLeft,
  Calendar,
  FolderKanban,
  Flag,
  Layers,
  Palette,
  Sparkles,
  Target,
} from 'lucide-react'
import { Area, Goal, Project } from '@c/types/index'
import type { FieldConfig, FieldOption } from '../types'
import { priorityOptions, statusOptions } from '../utils'

/**
 * Builds the field config for a project. Relation fields (area/goal) are passed
 * in from the store so the select options stay in sync with existing records.
 */
export const createProjectFields = ({
  areas,
  goals,
}: {
  areas: Area['Read'][]
  goals: Goal['Read'][]
}): FieldConfig<Project['Write']>[] => {
  const areaOptions: FieldOption[] = areas.map((area) => ({
    label: area.title,
    value: area.id,
  }))
  const goalOptions: FieldOption[] = goals.map((goal) => ({
    label: goal.title,
    value: goal.id,
  }))

  return [
    {
      name: 'title',
      label: 'Name',
      type: 'text',
      required: true,
      colSpan: 2,
      placeholder: 'What is this project about?',
      icon: FolderKanban,
    },
    {
      name: 'description',
      label: 'Description',
      type: 'textarea',
      colSpan: 2,
      placeholder: 'Optional details, scope, or context...',
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
      name: 'goal_id',
      label: 'Goal',
      type: 'select',
      options: goalOptions,
      allowEmpty: true,
      placeholder: 'No goal',
      icon: Target,
    },
    {
      name: 'due_date',
      label: 'Due date',
      type: 'date',
      placeholder: 'No due date',
      icon: Calendar,
    },
    {
      name: 'color',
      label: 'Color',
      type: 'text',
      placeholder: '#aabbcc',
      icon: Palette,
    },
    {
      name: 'icon',
      label: 'Icon',
      type: 'text',
      placeholder: 'e.g. folder-kanban',
      icon: Sparkles,
    },
  ]
}
