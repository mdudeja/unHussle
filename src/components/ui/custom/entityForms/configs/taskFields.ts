import {
  Activity,
  AlignLeft,
  Calendar,
  CalendarClock,
  CalendarSync,
  CheckSquare,
  Flag,
  FolderKanban,
  Hourglass,
  Layers,
  PartyPopper,
  Repeat,
  Target,
  WashingMachine,
  Zap,
  Hash,
  Link,
} from 'lucide-react'
import { Area, Goal, Project, Task, WithAttachments } from '@c/types/index'
import type { FieldConfig, FieldOption } from '../types'
import { priorityOptions, statusOptions } from '../utils'

/**
 * Builds the field config for a task. Relation fields (project/area/goal) are
 * passed in from the store so the select options stay in sync with existing
 * records.
 */
export const createTaskFields = ({
  projects,
  areas,
  goals,
}: {
  projects: Project['Read'][]
  areas: Area['Read'][]
  goals: Goal['Read'][]
}): FieldConfig<WithAttachments<Task['Write']>>[] => {
  const projectOptions: FieldOption[] = projects.map((project) => ({
    label: project.title,
    value: project.id,
  }))
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
      placeholder: 'What needs to be done?',
      icon: CheckSquare,
    },
    {
      name: 'description',
      label: 'Description',
      type: 'textarea',
      colSpan: 2,
      placeholder: 'Optional details, notes, or context...',
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
      name: 'project_id',
      label: 'Project',
      type: 'select',
      options: projectOptions,
      allowEmpty: true,
      placeholder: 'No project',
      icon: FolderKanban,
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
      name: 'estimated_minutes',
      label: 'Estimate (minutes)',
      type: 'number',
      min: 0,
      step: 5,
      placeholder: 'e.g. 30',
      icon: Hourglass,
    },
    {
      name: 'due_date',
      label: 'Due date',
      type: 'date',
      placeholder: 'No due date',
      icon: Calendar,
    },
    {
      name: 'scheduled_for',
      label: 'Scheduled for',
      type: 'date',
      placeholder: 'Not scheduled',
      icon: CalendarClock,
    },
    {
      name: 'is_quick',
      label: 'Quick',
      type: 'boolean',
      icon: Zap,
    },
    {
      name: 'is_fun',
      label: 'Fun',
      type: 'boolean',
      icon: PartyPopper,
    },
    {
      name: 'is_chore',
      label: 'Chore',
      type: 'boolean',
      icon: WashingMachine,
    },
    {
      name: 'is_recurring',
      label: 'Recurring',
      type: 'boolean',
      icon: Repeat,
    },
    {
      name: 'recurrance_rule',
      label: 'Recurrence',
      type: 'recurrance',
      colSpan: 2,
      icon: CalendarSync,
      visibleWhen: (values) => Boolean(values.is_recurring),
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
