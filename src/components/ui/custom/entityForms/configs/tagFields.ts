import { AlignLeft, Palette, Tag as TagIcon } from 'lucide-react'
import { Tag } from '@c/types/index'
import type { FieldConfig } from '../types'

/** Defines the form fields used to create or edit a tag, including its name, color, and description. */
export const createTagFields = (): FieldConfig<Tag['Write']>[] => [
  {
    name: 'title',
    label: 'Name',
    type: 'text',
    required: true,
    noSpacesAllowed: true,
    placeholder: 'e.g. deep-work',
    icon: TagIcon,
  },
  {
    name: 'color',
    label: 'Color',
    type: 'color',
    placeholder: 'Pick a color',
    icon: Palette,
  },
  {
    name: 'description',
    label: 'Description',
    type: 'textarea',
    colSpan: 2,
    placeholder: 'Optional details...',
    icon: AlignLeft,
  },
]
