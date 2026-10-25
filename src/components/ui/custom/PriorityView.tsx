import { Priority } from '@c/types'
import { AlertCircle, Minus, ChevronDown } from 'lucide-react'
import { toLabel } from '@/components/ui/utils/misc'

export const priorityIcon = ({ priority }: { priority: Priority }) => {
  return priority === Priority.HIGH ? (
    <AlertCircle className="h-3 w-3 text-destructive" />
  ) : priority === Priority.MEDIUM ? (
    <Minus className="h-3 w-3 text-muted-foreground" />
  ) : (
    <ChevronDown className="h-3 w-3 text-muted-foreground" />
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
      {priorityIcon({ priority: priority })}
      {toLabel(priority)}
    </span>
  )
}
