import { AlignLeft, Link2, Tag as TagIcon, Type } from 'lucide-react'
import type {
  Resource,
  ResourceLinkInput,
  WithSupporters,
} from '@c/types/index'
import type { FieldConfig } from '../types'

type ResourceForm = WithSupporters<Resource['Write']> & {
  links?: ResourceLinkInput[]
}

/** Metadata only; the content is edited on the resource's own page. */
export const createResourceFields = (): FieldConfig<ResourceForm>[] => [
  {
    name: 'title',
    label: 'Title',
    type: 'text',
    required: true,
    colSpan: 2,
    placeholder: 'e.g. Q3 plan',
    description: 'Also names the markdown file in the vault.',
    icon: Type,
  },
  {
    name: 'description',
    label: 'Description',
    type: 'textarea',
    colSpan: 2,
    placeholder: 'What is this resource for?',
    icon: AlignLeft,
  },
  {
    name: 'tags',
    label: 'Tags',
    type: 'tags',
    colSpan: 2,
    icon: TagIcon,
  },
  {
    name: 'links',
    label: 'Linked to',
    type: 'resourceLinks',
    colSpan: 2,
    description: 'Tasks under a linked project, goal or area see it too.',
    icon: Link2,
  },
]
