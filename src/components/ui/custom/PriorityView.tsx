import { Priority } from '@c/types/enums'
import { ChevronsLeftRight, ChevronsDown, ChevronsUp } from 'lucide-react'
import { toLabel } from '@/components/ui/utils/misc'

export const getPriorityIcon = (priority: string): React.ReactNode => {
  return <PriorityIcon priority={priority as Priority} />
}

export const PriorityIcon = ({ priority }: { priority: Priority }) => {
  return priority === Priority.HIGH ? (
    <ChevronsUp className="h-4 w-4 text-destructive" />
  ) : priority === Priority.MEDIUM ? (
    <ChevronsLeftRight className="h-4 w-4 text-primary" />
  ) : (
    <ChevronsDown className="h-4 w-4 text-muted-foreground" />
  )
}
export default function PriorityView({
  priority,
}: {
  priority?: Priority | null
}) {
  if (!priority) {
    return null
  }

  return (
    <span
      className={`flex items-center gap-1 ${priority === Priority.HIGH ? 'text-destructive' : 'text-muted-foreground'}`}
    >
      {PriorityIcon({ priority: priority })}
      {toLabel(priority)}
    </span>
  )
}
