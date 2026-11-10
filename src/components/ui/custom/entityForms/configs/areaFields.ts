import {
  AlignLeft,
  Boxes,
  FileText,
  Flag,
  Hash,
  Link,
  Palette,
  Sparkles,
} from 'lucide-react'
import { Area, WithSupporters } from '@c/types/index'
import type { FieldConfig } from '../types'
import { priorityOptions } from '../utils'

/** Creates the field configurations used to capture and edit an area’s core details, appearance, organization, and related resources. */
export const createAreaFields = (): FieldConfig<
  WithSupporters<Area['Write']>
>[] => [
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
  {
    name: 'resources',
    label: 'Resources',
    type: 'resources',
    colSpan: 2,
    icon: FileText,
  },
]
