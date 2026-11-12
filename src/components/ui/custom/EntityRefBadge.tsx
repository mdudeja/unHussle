import type { EntityReference } from '@c/types/readModels'
import { FolderKanban, GitGraph, Goal } from 'lucide-react'
import IconBadge from '@/components/ui/custom/IconBadge'
import { IconResolver } from '@/components/ui/utils/IconResolver'
import { getEntityItemRoute } from '@/lib/entityRoutes'
import { trimString } from '@/components/ui/utils/misc'
import { Link } from 'react-router'

const entityRefConfig = {
  projects: { variant: 'project', icon: FolderKanban },
  areas: { variant: 'area', icon: GitGraph },
  goals: { variant: 'goal', icon: Goal },
} as const

export type EntityRefKind = keyof typeof entityRefConfig

export default function EntityRefBadge({
  kind,
  record,
  ...props
}: Omit<React.ComponentProps<typeof Link>, 'to'> & {
  kind: EntityRefKind
  record: EntityReference
}) {
  if (!record) {
    return null
  }
  const { variant, icon: FallbackIcon } = entityRefConfig[kind]
  return (
    <Link
      to={getEntityItemRoute(kind, record.id)}
      onClick={(e) => e.stopPropagation()}
      {...props}
    >
      <IconBadge
        variant={variant}
        className="cursor-pointer"
        icon={
          record.icon ? (
            <IconResolver icon={record.icon} className="h-3 w-3" />
          ) : (
            <FallbackIcon className="h-3 w-3" />
          )
        }
        style={{
          color: record.color ?? undefined,
          borderColor: record.color ?? undefined,
        }}
      >
        {record.title && trimString(record.title, 16)}
      </IconBadge>
    </Link>
  )
}
