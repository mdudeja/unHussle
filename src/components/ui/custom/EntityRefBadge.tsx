import type { EntityReference } from '@c/types/readModels'
import { FolderKanban, GitGraph, Goal } from 'lucide-react'
import { Link } from 'react-router'
import IconBadge from '@/components/ui/custom/IconBadge'
import { IconResolver } from '@/components/ui/utils/IconResolver'
import { getEntityItemRoute } from '@/lib/entityRoutes'
import { trimString } from '@/components/ui/utils/misc'

const entityRefConfig = {
  projects: { variant: 'project', icon: FolderKanban },
  areas: { variant: 'area', icon: GitGraph },
  goals: { variant: 'goal', icon: Goal },
} as const

export type EntityRefKind = keyof typeof entityRefConfig

export default function EntityRefBadge({
  kind,
  record,
}: {
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
        {trimString(record.title, 24)}
      </IconBadge>
    </Link>
  )
}
