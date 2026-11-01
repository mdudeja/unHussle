import { AlignLeft, Link, Type } from 'lucide-react'
import { EntityUrl } from '@c/types/index'
import type { FieldConfig } from '../types'

const isValidUrl = (value: unknown): boolean => {
  if (typeof value !== 'string') return false
  try {
    new URL(value)
    return true
  } catch {
    return false
  }
}

export const createUrlFields = (): FieldConfig<EntityUrl['Write']>[] => [
  {
    name: 'url',
    label: 'URL',
    type: 'url',
    required: true,
    noSpacesAllowed: true,
    colSpan: 2,
    placeholder: 'https://example.com or pick a file',
    icon: Link,
    validate: (value) =>
      isValidUrl(value)
        ? undefined
        : 'Enter a full URL, including https:// or file://',
  },
  {
    name: 'title',
    label: 'Title',
    type: 'text',
    colSpan: 2,
    placeholder: 'Optional display name',
    icon: Type,
  },
  {
    name: 'description',
    label: 'Description',
    type: 'textarea',
    colSpan: 2,
    placeholder: 'Optional notes about this link...',
    icon: AlignLeft,
  },
]
