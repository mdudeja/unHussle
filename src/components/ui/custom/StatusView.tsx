import { ProgressStatus } from '@c/types/enums'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { toLabel } from '@/components/ui/utils/misc'

export default function StatusView({
  status,
}: {
  status?: ProgressStatus | null
}) {
  if (!status) {
    return null
  }

  return (
    <Badge
      variant={status === ProgressStatus.COMPLETED ? 'secondary' : 'outline'}
      className={cn(
        status === ProgressStatus.CANCELLED &&
          'text-muted-foreground line-through',
      )}
    >
      {toLabel(status)}
    </Badge>
  )
}
