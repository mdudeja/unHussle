import {
  Activity,
  AlignLeft,
  Boxes,
  Flag,
  Palette,
  Sparkles,
} from 'lucide-react'
import { Area } from '@c/types/index'
import type { FieldConfig } from '../types'
import { priorityOptions, statusOptions } from '../utils'

export const createAreaFields = (): FieldConfig<Area['Write']>[] => [
  {
    name: 'title',
    label: 'Name',
    type: 'text',
    required: true,
    colSpan: 2,
    placeholder: 'What area of life is this?',
    icon: Boxes,
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
    name: 'color',
    label: 'Color',
    type: 'color',
    placeholder: 'Pick a color',
    icon: Palette,
  },
  {
    name: 'icon',
    label: 'Icon',
    type: 'icon',
    placeholder: 'Pick an icon',
    icon: Sparkles,
  },
]
