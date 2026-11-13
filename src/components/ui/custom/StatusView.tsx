import { ProgressStatus } from '@c/types/enums'
import { cn } from '@/lib/utils'
import { toLabel } from '@/components/ui/utils/misc'
import {
  ArrowRightCircle,
  CheckCircle2,
  ChevronsRight,
  DatabaseBackup,
  FileQuestionMark,
  ListX,
  Loader,
  PauseCircle,
  Route,
} from 'lucide-react'
import IconBadge from '@/components/ui/custom/IconBadge'

export const getStatusIcon = (status: string): React.ReactNode => {
  return <StatusIcon status={status as ProgressStatus} />
}

export const StatusIcon = ({ status }: { status: ProgressStatus }) => {
  switch (status) {
    case ProgressStatus.PLANNED:
      return <Route className="h-4 w-4 text-muted-foreground" />
    case ProgressStatus.IN_PROGRESS:
      return <Loader className="h-4 w-4 text-warning" />
    case ProgressStatus.COMPLETED:
      return <CheckCircle2 className="h-4 w-4 text-success" />
    case ProgressStatus.PAUSED:
      return <PauseCircle className="h-4 w-4 text-warning" />
    case ProgressStatus.CANCELLED:
      return <ListX className="h-4 w-4 text-muted-foreground" />
    case ProgressStatus.ON_HOLD:
      return <FileQuestionMark className="h-4 w-4 text-muted-foreground" />
    case ProgressStatus.ARCHIVED:
      return <DatabaseBackup className="h-4 w-4 text-accent-foreground" />
    case ProgressStatus.MIGRATED:
      return <ArrowRightCircle className="h-4 w-4 text-success" />
    case ProgressStatus.SKIPPED:
      return <ChevronsRight className="h-4 w-4 text-chart-3" />
    default:
      return <Route className="h-4 w-4 text-muted-foreground" />
  }
}

export default function StatusView({
  status,
}: {
  status?: ProgressStatus | null
}) {
  if (!status) {
    return null
  }

  return (
    <IconBadge
      icon={<StatusIcon status={status} />}
      variant={status === ProgressStatus.COMPLETED ? 'secondary' : 'ghost'}
      className={cn(
        status === ProgressStatus.CANCELLED &&
          'text-muted-foreground line-through',
      )}
    >
      {toLabel(status)}
    </IconBadge>
  )
}
